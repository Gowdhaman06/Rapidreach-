/**
 * RapidReach - Firebase Configuration
 * Production-Ready Firebase Setup
 * 
 * HOW TO SETUP:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Create a new project named "RapidReach"
 * 3. Enable Authentication > Phone
 * 4. Create Firestore Database
 * 5. Create Realtime Database
 * 6. Enable Cloud Messaging
 * 7. Copy your web config and update below
 */

// Firebase Configuration - Production Project
// Project: rapidreach-g2026
const firebaseConfig = {
    apiKey: "AIzaSyB1N1dtnTOJ8fQmdvwB4JI7pBsKi21gQII",
    authDomain: "rapidreach-g2026.firebaseapp.com",
    projectId: "rapidreach-g2026",
    storageBucket: "rapidreach-g2026.firebasestorage.app",
    messagingSenderId: "155360129709",
    appId: "1:155360129709:web:f574f126d947dd529f4c24",
    databaseURL: "https://rapidreach-g2026.firebaseio.com",
    measurementId: "G-M6YLKXL8E0"
};

// Initialize Firebase
let auth, db, realtimeDb, messaging;
try {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase initialized successfully");
    
    // Get Firebase Services
    auth = firebase.auth();
    db = firebase.firestore();
    realtimeDb = firebase.database();
    messaging = firebase.messaging();
} catch (error) {
    console.error("❌ Firebase initialization error:", error);
    console.warn("⚠️ Firebase not properly configured. Please add your credentials to config/firebase-config.js");
}

// Expose Firebase services globally for access in other modules
window.firebaseConfig = {
    firebase: firebase,
    auth: auth,
    db: db,
    realtimeDb: realtimeDb,
    messaging: messaging,
    config: firebaseConfig
};

// Firebase App Check (Optional but Recommended)
// firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider('YOUR_RECAPTCHA_KEY'));

// ===========================
// Firebase Authentication Setup
// ===========================

// Configure Auth Settings
auth.languageCode = 'en';

// Setup reCAPTCHA verifier for phone authentication
function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            size: 'invisible',
            callback: (token) => {
                console.log('reCAPTCHA verified');
            },
            'expired-callback': () => {
                console.log('reCAPTCHA expired');
            }
        });
    }
}

// ===========================
// Database Schema Configuration
// ===========================

const DATABASE_SCHEMA = {
    COLLECTIONS: {
        USERS: 'users',
        DRIVERS: 'drivers',
        HOSPITALS: 'hospitals',
        AMBULANCES: 'ambulances',
        LIVE_LOCATIONS: 'liveLocations',
        EMERGENCY_ALERTS: 'emergencyAlerts',
        NOTIFICATIONS: 'notifications',
        ANALYTICS: 'analytics'
    },
    USER_ROLES: {
        DRIVER: 'driver',
        PUBLIC_USER: 'publicUser',
        HOSPITAL_OPERATOR: 'hospitalOperator',
        ADMIN: 'admin'
    }
};

// ===========================
// Firestore Security Rules (Deploy these)
// ===========================
const FIRESTORE_SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write only to authenticated users
    function isAuth() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuth() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isDriver() {
      return isAuth() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'driver';
    }
    
    function isHospital() {
      return isAuth() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'hospitalOperator';
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuth();
      allow create: if isAuth() && request.auth.uid == userId;
      allow update, delete: if isAuth() && request.auth.uid == userId || isAdmin();
    }

    // Drivers collection
    match /drivers/{driverId} {
      allow read: if isAuth();
      allow create, update: if isAuth() && request.auth.uid == driverId || isAdmin();
      allow delete: if isAdmin();
    }

    // Live Locations (Real-time updates)
    match /liveLocations/{locationId} {
      allow read: if isAuth();
      allow create, update: if isAuth();
      allow delete: if isAuth() && request.auth.uid == resource.data.driverId || isAdmin();
    }

    // Emergency Alerts
    match /emergencyAlerts/{alertId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update, delete: if isAdmin() || request.auth.uid == resource.data.reportedBy;
    }

    // Notifications
    match /notifications/{notificationId} {
      allow read: if isAuth() && request.auth.uid == resource.data.userId;
      allow create: if isAuth();
      allow delete: if isAuth() && request.auth.uid == resource.data.userId || isAdmin();
    }

    // Hospitals collection
    match /hospitals/{hospitalId} {
      allow read: if isAuth();
      allow create: if isAuth() && request.auth.uid == resource.data.operatorId || isAdmin();
      allow update: if isAuth() && request.auth.uid == resource.data.operatorId || isAdmin();
      allow delete: if isAdmin();
    }

    // Ambulances collection
    match /ambulances/{ambulanceId} {
      allow read: if isAuth();
      allow create: if isAuth() && isDriver() || isAdmin();
      allow update: if isAuth() && isDriver() || isAdmin();
      allow delete: if isAdmin();
    }

    // Analytics
    match /analytics/{analyticsId} {
      allow read: if isAdmin();
      allow create, update: if isAdmin();
    }
  }
}
`;

// ===========================
// Realtime Database Rules (Deploy these)
// ===========================
const REALTIME_DB_RULES = `
{
  "rules": {
    "activeLocations": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$locationId": {
        ".validate": "newData.hasChildren(['latitude', 'longitude', 'driverId', 'timestamp'])",
        "latitude": { ".validate": "newData.isNumber()" },
        "longitude": { ".validate": "newData.isNumber()" },
        "driverId": { ".validate": "newData.isString()" },
        "timestamp": { ".validate": "newData.isNumber()" }
      }
    },
    "ambulanceStatus": {
      ".read": "auth != null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'driver' || root.child('users').child(auth.uid).child('role').val() === 'admin'",
      "$ambulanceId": {
        ".validate": "newData.hasChildren(['status', 'lastUpdate'])"
      }
    }
  }
}
`;

// ===========================
// Cloud Messaging Setup
// ===========================

// Request notification permission
function requestNotificationPermission() {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            messaging.getToken().then(token => {
                console.log('FCM Token:', token);
                // Save token to user document
                saveNotificationToken(token);
            }).catch(error => {
                console.error('Error getting FCM token:', error);
            });
        }
    });
}

// Save notification token to Firestore
async function saveNotificationToken(token) {
    const user = auth.currentUser;
    if (user) {
        try {
            await db.collection('users').doc(user.uid).update({
                fcmToken: token,
                tokenUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving FCM token:', error);
        }
    }
}

// Handle incoming messages
messaging.onMessage((payload) => {
    console.log('Message received:', payload);
    
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/logo.png',
        badge: '/assets/badge.png',
        tag: payload.data.alertId,
        requireInteraction: payload.data.requireInteraction === 'true'
    };

    if (Notification.permission === 'granted') {
        new Notification(payload.notification.title, notificationOptions);
    }
});

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Background message:', payload);
});

// ===========================
// Export Configuration
// ===========================

window.firebaseConfig = {
    auth,
    db,
    realtimeDb,
    messaging,
    firebase,
    setupRecaptcha,
    requestNotificationPermission,
    DATABASE_SCHEMA
};

console.log("🔧 Firebase configuration loaded - Ready for use");
