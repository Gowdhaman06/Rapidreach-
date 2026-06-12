/**
 * RapidReach - Route Protection & Navigation
 * Handles role-based access control and routing
 */

class RouteProtection {
    constructor() {
        // Safely get Firebase references
        this.auth = window.firebaseConfig?.auth;
        this.db = window.firebaseConfig?.db;
        
        // If Firebase not ready, wait a moment and retry
        if (!this.auth || !this.db) {
            console.warn('⚠️ Firebase not ready in RouteProtection constructor');
            setTimeout(() => this.initialize(), 500);
        }
        
        this.allowedRoutes = {
            'driver': ['driver-dashboard.html', 'driver-profile.html', 'driver-vehicle.html'],
            'publicUser': ['public-dashboard.html', 'hospital-list.html', 'emergency-alert.html'],
            'hospitalOperator': ['hospital-dashboard.html', 'hospital-profile.html', 'hospital-ambulances.html'],
            'admin': ['admin-dashboard.html', 'admin-users.html', 'admin-ambulances.html', 'admin-hospitals.html', 'admin-analytics.html']
        };
        this.publicPages = ['index.html', 'login.html', 'role-selector.html', '404.html'];
    }

    /**
     * Initialize when Firebase is ready
     */
    initialize() {
        if (!window.firebaseConfig?.auth) {
            console.error('❌ Firebase still not available');
            return;
        }
        this.auth = window.firebaseConfig.auth;
        this.db = window.firebaseConfig.db;
        console.log('✅ RouteProtection initialized');
    }

    /**
     * Check if User is Authenticated
     * Redirect to login if not
     */
    async checkAuthentication() {
        return new Promise((resolve) => {
            // If Firebase not initialized, redirect to login
            if (!this.auth) {
                console.warn('⚠️ Firebase not initialized');
                window.location.href = 'login.html';
                resolve(false);
                return;
            }
            
            const user = this.auth.currentUser;
            
            if (!user) {
                // Not authenticated - redirect to login
                if (!this.isPublicPage(window.location.pathname)) {
                    window.location.href = 'login.html';
                }
                resolve(false);
            } else {
                resolve(true);
            }
        });
    }

    /**
     * Check if Page Requires Authentication
     * @param {string} pathname
     */
    async protectRoute(pathname) {
        try {
            if (this.isPublicPage(pathname)) {
                return true;
            }

            const user = this.auth.currentUser;
            if (!user) {
                window.location.href = 'login.html';
                return false;
            }

            // Check if user role is set
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            if (!userDoc.exists || !userDoc.data().role) {
                // New user - redirect to role selector
                if (!pathname.includes('role-selector.html')) {
                    window.location.href = 'role-selector.html';
                }
                return false;
            }

            const userRole = userDoc.data().role;
            const pageName = this.getPageName(pathname);

            // Check if user has permission to access this page
            if (!this.hasPermission(userRole, pageName)) {
                window.location.href = '404.html';
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error protecting route:', error);
            window.location.href = 'login.html';
            return false;
        }
    }

    /**
     * Check if User Has Permission to Access Page
     * @param {string} role
     * @param {string} pageName
     * @returns {boolean}
     */
    hasPermission(role, pageName) {
        const allowedPages = this.allowedRoutes[role] || [];
        return allowedPages.includes(pageName);
    }

    /**
     * Check if Page is Public
     * @param {string} pathname
     * @returns {boolean}
     */
    isPublicPage(pathname) {
        const pageName = this.getPageName(pathname);
        return this.publicPages.includes(pageName);
    }

    /**
     * Extract Page Name from Pathname
     * @param {string} pathname
     * @returns {string}
     */
    getPageName(pathname) {
        return pathname.split('/').pop() || 'index.html';
    }

    /**
     * Navigate to Page
     * @param {string} page
     */
    navigateTo(page) {
        const user = this.auth.currentUser;
        if (user) {
            this.db.collection('users').doc(user.uid).get().then((doc) => {
                const userRole = doc.data()?.role;
                if (this.hasPermission(userRole, page)) {
                    window.location.href = page;
                } else {
                    window.notificationSystem.sendNotification({
                        type: 'error',
                        title: 'Access Denied',
                        message: 'You do not have permission to access this page.'
                    });
                }
            });
        } else {
            window.location.href = 'login.html';
        }
    }

    /**
     * Navigate Based on User Role
     * Redirects to appropriate dashboard after login
     */
    async navigateByRole() {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            const userDoc = await this.db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                window.location.href = 'role-selector.html';
                return;
            }

            const userRole = userDoc.data().role;

            const roleRoutes = {
                'driver': 'driver-dashboard.html',
                'publicUser': 'public-dashboard.html',
                'hospitalOperator': 'hospital-dashboard.html',
                'admin': 'admin-dashboard.html'
            };

            const targetPage = roleRoutes[userRole] || 'index.html';
            window.location.href = targetPage;
        } catch (error) {
            console.error('Error navigating by role:', error);
            window.location.href = 'index.html';
        }
    }

    /**
     * Logout and Redirect
     */
    async logout() {
        try {
            await window.rapidReachAuth.logout();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error during logout:', error);
            window.location.href = 'index.html';
        }
    }

    /**
     * Get User Information
     * @returns {Promise<Object>}
     */
    async getUserInfo() {
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
            console.error('Error getting user info:', error);
            return null;
        }
    }

    /**
     * Update User Profile
     * @param {Object} profileData
     */
    async updateProfile(profileData) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            await this.db.collection('users').doc(user.uid).update({
                ...profileData,
                updatedAt: window.firebaseConfig.firebase.firestore.FieldValue.serverTimestamp()
            });

            window.notificationSystem.sendNotification({
                type: 'success',
                title: 'Profile Updated',
                message: 'Your profile has been updated successfully.'
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }

    /**
     * Update User Settings/Preferences
     * @param {Object} preferences
     */
    async updatePreferences(preferences) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            await this.db.collection('users').doc(user.uid).update({
                preferences: {
                    ...preferences
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating preferences:', error);
            throw error;
        }
    }
}

// Initialize Route Protection
window.routeProtection = new RouteProtection();

// Protect current page on load
document.addEventListener('DOMContentLoaded', () => {
    window.routeProtection.protectRoute(window.location.pathname);
});

console.log("✅ Route Protection loaded");
