/**
 * RapidReach - Authentication Module
 * Handles Firebase Phone Authentication & Session Management
 */

class RapidReachAuth {
    constructor() {
        this.auth = window.firebaseConfig.auth;
        this.db = window.firebaseConfig.db;
        this.firebase = window.firebaseConfig.firebase;
        this.confirmationResult = null;
        this.setupAuthStateListener();
    }

    /**
     * Setup Firebase Auth State Listener
     * Tracks user login/logout across app
     */
    setupAuthStateListener() {
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('✅ User logged in:', user.phoneNumber);
                this.saveSessionData(user);
                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: user }));
            } else {
                console.log('👤 User logged out');
                this.clearSessionData();
                window.dispatchEvent(new CustomEvent('userLoggedOut'));
            }
        });
    }

    /**
     * Send OTP to Phone Number
     * @param {string} phoneNumber - Phone number with country code (e.g., +919876543210)
     * @returns {Promise}
     */
    async sendOTP(phoneNumber) {
        try {
            // Validate phone number format
            if (!this.validatePhoneNumber(phoneNumber)) {
                throw new Error('Invalid phone number format. Use +[country-code][number]');
            }

            window.firebaseConfig.setupRecaptcha();
            
            this.confirmationResult = await this.auth.signInWithPhoneNumber(
                phoneNumber,
                window.recaptchaVerifier
            );

            console.log('✅ OTP sent successfully to', phoneNumber);
            return { success: true, message: 'OTP sent successfully' };
        } catch (error) {
            console.error('❌ Error sending OTP:', error);
            if (error.code === 'auth/invalid-phone-number') {
                throw new Error('Invalid phone number format');
            } else if (error.code === 'auth/too-many-requests') {
                throw new Error('Too many requests. Please try again later.');
            }
            throw error;
        }
    }

    /**
     * Verify OTP and Complete Login
     * @param {string} otp - 6-digit OTP
     * @returns {Promise}
     */
    async verifyOTP(otp) {
        try {
            if (!this.confirmationResult) {
                throw new Error('OTP session expired. Please request new OTP.');
            }

            if (!otp || otp.length !== 6) {
                throw new Error('OTP must be 6 digits');
            }

            const userCredential = await this.confirmationResult.confirm(otp);
            const user = userCredential.user;

            console.log('✅ OTP verified, user authenticated');

            // Check if user exists in Firestore
            const userDoc = await this.db.collection('users').doc(user.uid).get();

            if (!userDoc.exists) {
                // New user - store in Firestore
                await this.createUserProfile(user);
                return { 
                    success: true, 
                    isNewUser: true,
                    message: 'Authentication successful. Please select your role.'
                };
            }

            return { 
                success: true, 
                isNewUser: false,
                message: 'Login successful' 
            };
        } catch (error) {
            console.error('❌ Error verifying OTP:', error);
            if (error.code === 'auth/invalid-verification-code') {
                throw new Error('Invalid OTP. Please try again.');
            } else if (error.code === 'auth/code-expired') {
                throw new Error('OTP expired. Please request new OTP.');
            }
            throw error;
        }
    }

    /**
     * Create User Profile in Firestore
     * @param {FirebaseUser} user - Firebase user object
     */
    async createUserProfile(user) {
        try {
            await this.db.collection('users').doc(user.uid).set({
                uid: user.uid,
                phoneNumber: user.phoneNumber,
                createdAt: this.firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: this.firebase.firestore.FieldValue.serverTimestamp(),
                role: null, // To be set during role selection
                status: 'active',
                isVerified: true,
                lastLogin: this.firebase.firestore.FieldValue.serverTimestamp(),
                deviceTokens: [],
                preferences: {
                    notifications: true,
                    soundAlerts: true,
                    emailNotifications: false
                }
            });

            console.log('✅ User profile created');
        } catch (error) {
            console.error('❌ Error creating user profile:', error);
            throw error;
        }
    }

    /**
     * Update User Role After Selection
     * @param {string} role - User role (driver, publicUser, hospitalOperator, admin)
     */
    async setUserRole(role) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('No user logged in');

            const validRoles = ['driver', 'publicUser', 'hospitalOperator', 'admin'];
            if (!validRoles.includes(role)) {
                throw new Error('Invalid role');
            }

            await this.db.collection('users').doc(user.uid).update({
                role: role,
                updatedAt: this.firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ User role set to:', role);
            return { success: true, role: role };
        } catch (error) {
            console.error('❌ Error setting user role:', error);
            throw error;
        }
    }

    /**
     * Get Current User Data
     * @returns {Promise<Object>} User data from Firestore
     */
    async getCurrentUser() {
        try {
            const user = this.auth.currentUser;
            if (!user) return null;

            const userDoc = await this.db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) return null;

            return {
                uid: user.uid,
                phoneNumber: user.phoneNumber,
                ...userDoc.data()
            };
        } catch (error) {
            console.error('❌ Error getting current user:', error);
            return null;
        }
    }

    /**
     * Logout User
     */
    async logout() {
        try {
            const user = this.auth.currentUser;
            if (user) {
                // Update last logout time
                await this.db.collection('users').doc(user.uid).update({
                    lastLogout: this.firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            await this.auth.signOut();
            console.log('✅ User logged out');
            return { success: true, message: 'Logged out successfully' };
        } catch (error) {
            console.error('❌ Error during logout:', error);
            throw error;
        }
    }

    /**
     * Validate Phone Number Format
     * @param {string} phoneNumber
     * @returns {boolean}
     */
    validatePhoneNumber(phoneNumber) {
        // Check if starts with + and has minimum 10 digits
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phoneNumber);
    }

    /**
     * Save Session Data to LocalStorage
     */
    saveSessionData(user) {
        sessionStorage.setItem('rapidReachUser', JSON.stringify({
            uid: user.uid,
            phoneNumber: user.phoneNumber,
            lastActivity: Date.now()
        }));
    }

    /**
     * Clear Session Data
     */
    clearSessionData() {
        sessionStorage.removeItem('rapidReachUser');
        localStorage.removeItem('rapidReachUserPreferences');
    }

    /**
     * Check if User is Authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.auth.currentUser !== null;
    }

    /**
     * Get User Role
     * @returns {Promise<string|null>}
     */
    async getUserRole() {
        const user = await this.getCurrentUser();
        return user ? user.role : null;
    }

    /**
     * Check if User Has Specific Role
     * @param {string} role
     * @returns {Promise<boolean>}
     */
    async hasRole(role) {
        const userRole = await this.getUserRole();
        return userRole === role;
    }

    /**
     * Update User Status
     * @param {string} status - 'active', 'offline', 'away'
     */
    async updateUserStatus(status) {
        try {
            const user = this.auth.currentUser;
            if (!user) return;

            await this.db.collection('users').doc(user.uid).update({
                status: status,
                updatedAt: this.firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('❌ Error updating user status:', error);
        }
    }

    /**
     * Update Last Activity
     */
    updateLastActivity() {
        try {
            const user = this.auth.currentUser;
            if (!user) return;

            this.db.collection('users').doc(user.uid).update({
                lastActivity: this.firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error('Error updating activity:', err));
        } catch (error) {
            console.error('Error in updateLastActivity:', error);
        }
    }

    /**
     * Resend OTP
     * @param {string} phoneNumber
     */
    async resendOTP(phoneNumber) {
        // Clear previous confirmation result
        this.confirmationResult = null;
        
        // Send new OTP
        return this.sendOTP(phoneNumber);
    }
}

// Initialize Authentication Module
window.rapidReachAuth = new RapidReachAuth();

// Update last activity on user interaction
document.addEventListener('mousemove', () => {
    if (window.rapidReachAuth && window.rapidReachAuth.isAuthenticated()) {
        window.rapidReachAuth.updateLastActivity();
    }
});

console.log("✅ Authentication module loaded");
