/**
 * RapidReach - GPS Tracking Module
 * Real-time GPS tracking and location sharing
 */

class GPSTracker {
    constructor() {
        this.db = window.firebaseConfig.realtimeDb;
        this.firestore = window.firebaseConfig.db;
        this.firebase = window.firebaseConfig.firebase;
        this.auth = window.firebaseConfig.auth;
        
        this.watchId = null;
        this.isTracking = false;
        this.updateInterval = 5000; // Update every 5 seconds
        this.lastUpdateTime = 0;
        this.currentLocation = null;
        this.locationCache = [];
        this.maxCacheSize = 100;
    }

    /**
     * Start GPS Tracking
     * @param {number} interval - Update interval in milliseconds (default: 5000ms)
     * @returns {Promise}
     */
    async startTracking(interval = 5000) {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            this.updateInterval = interval;
            this.isTracking = true;

            if (!navigator.geolocation) {
                throw new Error('Geolocation not supported in this browser');
            }

            // Request high accuracy GPS
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.handleLocationUpdate(position),
                (error) => this.handleLocationError(error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 10000
                }
            );

            console.log('✅ GPS tracking started');
            window.dispatchEvent(new CustomEvent('trackingStarted'));
            
            return { success: true, message: 'GPS tracking started' };
        } catch (error) {
            console.error('❌ Error starting GPS tracking:', error);
            this.isTracking = false;
            throw error;
        }
    }

    /**
     * Stop GPS Tracking
     */
    async stopTracking() {
        try {
            if (this.watchId) {
                navigator.geolocation.clearWatch(this.watchId);
                this.watchId = null;
            }

            this.isTracking = false;

            const user = this.auth.currentUser;
            if (user) {
                // Update status in database
                await this.firestore.collection('drivers').doc(user.uid).update({
                    isTracking: false,
                    lastTrackingStop: this.firebase.firestore.FieldValue.serverTimestamp()
                }).catch(err => console.error('Error updating tracking status:', err));
            }

            console.log('✅ GPS tracking stopped');
            window.dispatchEvent(new CustomEvent('trackingStopped'));
            
            return { success: true, message: 'GPS tracking stopped' };
        } catch (error) {
            console.error('❌ Error stopping GPS tracking:', error);
            throw error;
        }
    }

    /**
     * Handle Location Update
     * @param {GeolocationPosition} position
     */
    async handleLocationUpdate(position) {
        try {
            const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
            const timestamp = Date.now();

            // Throttle updates
            if (timestamp - this.lastUpdateTime < this.updateInterval) {
                return;
            }

            this.lastUpdateTime = timestamp;
            this.currentLocation = { latitude, longitude, accuracy, altitude, heading, speed, timestamp };

            // Cache location for offline support
            this.locationCache.push(this.currentLocation);
            if (this.locationCache.length > this.maxCacheSize) {
                this.locationCache.shift();
            }

            const user = this.auth.currentUser;
            if (!user) return;

            // Update in Realtime Database for real-time updates
            const locationRef = this.db.ref(`activeLocations/${user.uid}`);
            await locationRef.set({
                latitude,
                longitude,
                accuracy,
                altitude,
                heading,
                speed,
                timestamp,
                driverId: user.uid
            });

            // Also store in Firestore for historical data
            await this.firestore.collection('liveLocations').add({
                driverId: user.uid,
                latitude,
                longitude,
                accuracy,
                altitude,
                heading,
                speed,
                timestamp: this.firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: this.firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log(`📍 Location updated: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} | Accuracy: ${accuracy.toFixed(1)}m`);
            
            // Dispatch event with location data
            window.dispatchEvent(new CustomEvent('locationUpdated', {
                detail: { latitude, longitude, accuracy, speed }
            }));

        } catch (error) {
            console.error('❌ Error handling location update:', error);
        }
    }

    /**
     * Handle Geolocation Errors
     * @param {GeolocationPositionError} error
     */
    handleLocationError(error) {
        let errorMessage = 'Unknown geolocation error';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'GPS Permission denied. Please enable location access in browser settings.';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'GPS position unavailable. Please try again.';
                break;
            case error.TIMEOUT:
                errorMessage = 'GPS request timed out. Retrying...';
                break;
        }

        console.error('❌ Geolocation Error:', errorMessage);
        window.dispatchEvent(new CustomEvent('trackingError', { detail: { message: errorMessage } }));
    }

    /**
     * Request Location Permission (for PWA)
     * @returns {Promise<PermissionStatus>}
     */
    async requestLocationPermission() {
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            return permission.state;
        } catch (error) {
            console.error('Error checking location permission:', error);
            return null;
        }
    }

    /**
     * Get Current Location (One-time)
     * @returns {Promise}
     */
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    this.currentLocation = { latitude, longitude, accuracy };
                    resolve({ latitude, longitude, accuracy });
                },
                (error) => {
                    reject(new Error(`Geolocation error: ${error.message}`));
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    /**
     * Calculate Distance Between Two Points
     * Haversine formula
     * @param {number} lat1, @param {number} lon1, @param {number} lat2, @param {number} lon2
     * @returns {number} Distance in meters
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Calculate ETA (Estimated Time of Arrival)
     * @param {number} distance - Distance in meters
     * @param {number} averageSpeed - Average speed in m/s (default: 15 m/s = 54 km/h)
     * @returns {number} ETA in seconds
     */
    static calculateETA(distance, averageSpeed = 15) {
        if (distance <= 0 || averageSpeed <= 0) return 0;
        return Math.round(distance / averageSpeed);
    }

    /**
     * Format Time Duration
     * @param {number} seconds
     * @returns {string} Formatted time
     */
    static formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    /**
     * Get Current Location from Cache
     * @returns {Object|null}
     */
    getLastKnownLocation() {
        return this.currentLocation;
    }

    /**
     * Get Location History
     * @returns {Array}
     */
    getLocationHistory() {
        return [...this.locationCache];
    }

    /**
     * Clear Location History
     */
    clearLocationHistory() {
        this.locationCache = [];
    }

    /**
     * Is Currently Tracking
     * @returns {boolean}
     */
    isCurrentlyTracking() {
        return this.isTracking;
    }

    /**
     * Get Tracking Status
     * @returns {Object}
     */
    getTrackingStatus() {
        return {
            isTracking: this.isTracking,
            lastLocation: this.currentLocation,
            cacheSize: this.locationCache.length,
            updateInterval: this.updateInterval
        };
    }

    /**
     * Subscribe to Location Updates
     * @param {Function} callback
     */
    onLocationUpdate(callback) {
        window.addEventListener('locationUpdated', (e) => {
            callback(e.detail);
        });
    }

    /**
     * Subscribe to Tracking Errors
     * @param {Function} callback
     */
    onTrackingError(callback) {
        window.addEventListener('trackingError', (e) => {
            callback(e.detail);
        });
    }
}

// Initialize GPS Tracker
window.gpsTracker = new GPSTracker();

console.log("✅ GPS Tracking module loaded");
