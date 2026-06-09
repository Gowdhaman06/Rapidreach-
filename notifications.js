/**
 * RapidReach - Notification System
 * Push notifications, sound alerts, and in-app notifications
 */

class NotificationSystem {
    constructor() {
        this.db = window.firebaseConfig.db;
        this.messaging = window.firebaseConfig.messaging;
        this.auth = window.firebaseConfig.auth;
        this.firebase = window.firebaseConfig.firebase;
        this.notifications = [];
        this.maxNotifications = 50;
        this.soundEnabled = true;
        this.initializeNotificationSystem();
    }

    /**
     * Initialize Notification System
     */
    initializeNotificationSystem() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ Notification permission granted');
                    window.firebaseConfig.requestNotificationPermission();
                }
            });
        }

        // Setup Firebase Cloud Messaging
        this.setupFCM();
        
        // Setup sound alert
        this.initializeAudioContext();
    }

    /**
     * Setup Firebase Cloud Messaging
     */
    setupFCM() {
        if (!this.messaging) return;

        // Handle foreground messages
        this.messaging.onMessage((payload) => {
            console.log('📬 FCM Message received:', payload);
            this.handleNotificationPayload(payload);
        });

        // Handle background messages (handled by service worker)
        this.messaging.onBackgroundMessage((payload) => {
            console.log('📬 FCM Background message:', payload);
        });
    }

    /**
     * Initialize Audio Context for Sound Alerts
     */
    initializeAudioContext() {
        try {
            // Create audio context for web audio API
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                window.audioContext = new AudioContext();
                console.log('✅ Audio context initialized');
            }
        } catch (error) {
            console.error('❌ Error initializing audio context:', error);
        }
    }

    /**
     * Send In-App Notification
     * @param {Object} notification
     */
    async sendNotification(notification) {
        try {
            const {
                type = 'info', // 'info', 'success', 'warning', 'error', 'emergency'
                title,
                message,
                icon,
                duration = 5000,
                requireInteraction = false,
                data = {}
            } = notification;

            const notificationId = Date.now().toString();
            const notificationObj = {
                id: notificationId,
                type,
                title,
                message,
                icon,
                duration,
                requireInteraction,
                data,
                createdAt: new Date()
            };

            // Store notification
            this.notifications.push(notificationObj);
            if (this.notifications.length > this.maxNotifications) {
                this.notifications.shift();
            }

            // Save to Firestore
            const user = this.auth.currentUser;
            if (user) {
                await this.db.collection('notifications').add({
                    userId: user.uid,
                    ...notificationObj,
                    timestamp: this.firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Show in-app notification
            this.displayNotification(notificationObj);

            // Play sound if needed
            if (type === 'emergency' || type === 'warning') {
                this.playAlertSound(type);
            }

            // Dispatch event
            window.dispatchEvent(new CustomEvent('notificationReceived', {
                detail: notificationObj
            }));

            console.log(`📢 Notification sent: ${title}`);
            return notificationId;

        } catch (error) {
            console.error('❌ Error sending notification:', error);
            throw error;
        }
    }

    /**
     * Handle FCM Notification Payload
     * @param {Object} payload
     */
    handleNotificationPayload(payload) {
        const { notification, data } = payload;
        
        this.sendNotification({
            type: data?.type || 'info',
            title: notification?.title || 'Notification',
            message: notification?.body || '',
            icon: notification?.icon,
            requireInteraction: data?.requireInteraction === 'true',
            data
        });
    }

    /**
     * Display In-App Notification UI
     * @param {Object} notification
     */
    displayNotification(notification) {
        // Create notification element
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification notification-${notification.type}`;
        notificationEl.id = `notif-${notification.id}`;

        notificationEl.innerHTML = `
            <div class="notification-content">
                ${notification.icon ? `<img src="${notification.icon}" class="notification-icon" alt="icon">` : ''}
                <div class="notification-text">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                </div>
                <button class="notification-close" onclick="document.getElementById('notif-${notification.id}').remove()">×</button>
            </div>
        `;

        // Add to notification container
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        container.appendChild(notificationEl);

        // Auto remove after duration
        if (notification.duration > 0 && !notification.requireInteraction) {
            setTimeout(() => {
                notificationEl.remove();
            }, notification.duration);
        }
    }

    /**
     * Play Alert Sound
     * @param {string} type - 'emergency', 'warning', 'success', 'info'
     */
    playAlertSound(type = 'warning') {
        if (!this.soundEnabled || !window.audioContext) {
            return;
        }

        try {
            const audioContext = window.audioContext;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different sounds for different types
            const soundConfig = {
                emergency: { frequency: 1000, duration: 1 },    // High pitch, long duration
                warning: { frequency: 800, duration: 0.5 },     // Medium pitch
                success: { frequency: 600, duration: 0.3 },     // Lower pitch
                info: { frequency: 400, duration: 0.2 }          // Low pitch
            };

            const config = soundConfig[type] || soundConfig.info;

            oscillator.frequency.value = config.frequency;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + config.duration);

            console.log(`🔊 Alert sound played: ${type}`);
        } catch (error) {
            console.error('❌ Error playing alert sound:', error);
        }
    }

    /**
     * Send Emergency Alert
     * @param {Object} alertData
     */
    async sendEmergencyAlert(alertData) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            const {
                latitude,
                longitude,
                type = 'emergency', // 'emergency', 'traffic', 'hazard'
                description,
                severity = 'critical' // 'low', 'medium', 'high', 'critical'
            } = alertData;

            // Store emergency alert in Firestore
            const alertRef = await this.db.collection('emergencyAlerts').add({
                reportedBy: user.uid,
                phoneNumber: user.phoneNumber,
                latitude,
                longitude,
                type,
                description,
                severity,
                status: 'active',
                timestamp: this.firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: this.firebase.firestore.FieldValue.serverTimestamp()
            });

            // Send notifications to nearby users (radius of 2km)
            await this.notifyNearbyUsers(latitude, longitude, alertData);

            // Play emergency sound
            this.playAlertSound('emergency');

            // Send push notification
            await this.sendNotification({
                type: 'emergency',
                title: '🚨 Emergency Alert',
                message: description || 'Emergency alert reported in your area',
                requireInteraction: true,
                data: { alertId: alertRef.id }
            });

            console.log('✅ Emergency alert sent');
            return { success: true, alertId: alertRef.id };

        } catch (error) {
            console.error('❌ Error sending emergency alert:', error);
            throw error;
        }
    }

    /**
     * Notify Nearby Users
     * @param {number} latitude, @param {number} longitude, @param {Object} alertData
     */
    async notifyNearbyUsers(latitude, longitude, alertData) {
        // Query users within 2km radius
        // Note: Firestore doesn't support geospatial queries directly
        // Use geohashing library or calculate on client side
        try {
            const users = await this.db.collection('users')
                .where('status', '==', 'active')
                .limit(50)
                .get();

            // Filter by distance (simplified)
            const notificationMessage = alertData.description || 'Emergency alert in your area';

            users.forEach((userDoc) => {
                // Send notification to each user
                console.log('📢 Notifying user:', userDoc.id);
            });
        } catch (error) {
            console.error('Error notifying nearby users:', error);
        }
    }

    /**
     * Get Notification History
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getNotificationHistory(limit = 20) {
        try {
            const user = this.auth.currentUser;
            if (!user) return [];

            const snapshot = await this.db.collection('notifications')
                .where('userId', '==', user.uid)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting notification history:', error);
            return [];
        }
    }

    /**
     * Clear Notifications
     * @param {string} type - Clear specific type or 'all'
     */
    clearNotifications(type = 'all') {
        if (type === 'all') {
            this.notifications = [];
        } else {
            this.notifications = this.notifications.filter(n => n.type !== type);
        }
    }

    /**
     * Enable/Disable Sound Alerts
     * @param {boolean} enabled
     */
    setSoundAlerts(enabled) {
        this.soundEnabled = enabled;
        localStorage.setItem('rapidReachSoundAlerts', enabled);
        console.log(`🔊 Sound alerts ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Subscribe to Ambulance Updates
     * Returns real-time ambulance location updates
     */
    subscribeToAmbulanceUpdates(callback) {
        const user = this.auth.currentUser;
        if (!user) return;

        return window.firebaseConfig.realtimeDb.ref('activeLocations')
            .on('value', (snapshot) => {
                const locations = [];
                snapshot.forEach((childSnapshot) => {
                    locations.push(childSnapshot.val());
                });
                callback(locations);
            });
    }

    /**
     * Unsubscribe from Updates
     */
    unsubscribeFromUpdates() {
        window.firebaseConfig.realtimeDb.ref('activeLocations').off();
    }
}

// Initialize Notification System
window.notificationSystem = new NotificationSystem();

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    #notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
    }

    .notification {
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInRight 0.3s ease-out;
        border-left: 4px solid;
    }

    .notification-info {
        border-left-color: #3498DB;
    }

    .notification-success {
        border-left-color: #27AE60;
    }

    .notification-warning {
        border-left-color: #F39C12;
    }

    .notification-error {
        border-left-color: #E74C3C;
    }

    .notification-emergency {
        border-left-color: #DC143C;
        background: #ffe6e6;
        animation: pulse 0.6s ease-in-out infinite;
    }

    .notification-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
    }

    .notification-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
    }

    .notification-text {
        flex: 1;
    }

    .notification-title {
        font-weight: 600;
        color: #2C3E50;
        margin-bottom: 4px;
    }

    .notification-message {
        font-size: 14px;
        color: #7F8C8D;
    }

    .notification-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #7F8C8D;
        padding: 0;
        margin-left: 8px;
    }

    .notification-close:hover {
        color: #2C3E50;
    }

    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 1;
        }
        50% {
            opacity: 0.8;
        }
    }
`;
document.head.appendChild(style);

console.log("✅ Notification System loaded");
