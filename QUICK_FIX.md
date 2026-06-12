# RapidReach - Quick Firebase Fix Guide

## 🔴 Problem
Nothing is working because **Firebase credentials are not configured**.

## 🟢 Solution (3 Steps, 2 minutes)

### Step 1: Get Your Firebase Credentials
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project called "RapidReach"
3. Once created, click Project Settings (⚙️)
4. Scroll to "Your apps" → Click **"</> Web"**
5. Copy the config object

### Step 2: Update Configuration
Open `config/firebase-config.js` and replace this:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    authDomain: "rapidreach-xxxxx.firebaseapp.com",
    projectId: "rapidreach-xxxxx",
    storageBucket: "rapidreach-xxxxx.appspot.com",
    messagingSenderId: "123456789xxx",
    appId: "1:123456789xxx:web:xxxxxxxxxx",
    databaseURL: "https://rapidreach-xxxxx.firebaseio.com"
};
```

With your actual config from Firebase Console (paste your credentials).

### Step 3: Enable Firebase Services
In your Firebase project:
- ✅ **Authentication** → Enable **Phone** provider
- ✅ **Firestore Database** → Create database
- ✅ **Realtime Database** → Create database
- ✅ **Cloud Messaging** → Should auto-enable

### Step 4: Refresh Browser
Refresh the page - you should see ✅ **"Firebase initialized successfully"** in console.

---

## 📝 For More Details
See `FIREBASE_SETUP.md` for complete setup with security rules.

## ✅ After Setup Works
- Login with phone OTP ✅
- GPS tracking works ✅
- Real-time location updates ✅
- Live maps show ambulances ✅
- Emergency alerts work ✅
