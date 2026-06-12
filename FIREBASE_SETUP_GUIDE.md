# RapidReach Firebase Setup Guide

## ⚡ Quick Setup (5 Minutes)

### Step 1: Get Your API Key
1. Open **Firebase Console**: https://console.firebase.google.com/
2. Select your project **"rapidreach-g2026"**
3. Click **⚙️ Project Settings** (gear icon)
4. Scroll to "Your apps" section
5. Click on your **Web App** (should show `1:155360129709:web:f574f126d947dd529f4c24`)
6. Copy the **API Key** (looks like: `AIzaSy...`)

### Step 2: Update Firebase Configuration
1. Open `config/firebase-config.js`
2. Replace `AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx` with your **API Key**
3. Save the file

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",  // ← Paste your API key here
    authDomain: "rapidreach-g2026.firebaseapp.com",
    projectId: "rapidreach-g2026",
    storageBucket: "rapidreach-g2026.firebasestorage.app",
    messagingSenderId: "155360129709",
    appId: "1:155360129709:web:f574f126d947dd529f4c24",
    databaseURL: "https://rapidreach-g2026.firebaseio.com"
};
```

## ✅ Firebase Setup Checklist

### Authentication
- [ ] Enable **Phone Number Authentication**
  - Go to: Authentication > Sign-in method > Phone
  - Click Enable and Save
  - Add your test phone numbers (optional)

### Firestore Database
- [ ] Create **Firestore Database**
  - Go to: Firestore Database > Create Database
  - Start in **Production** mode
  - Choose your region (closest to users)

- [ ] Set Security Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - accessible by owner
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Emergency Alerts - accessible by authenticated users
    match /emergencyAlerts/{alertId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null;
    }
    
    // Live Locations - readable by all authenticated users
    match /liveLocations/{doc=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### Realtime Database
- [ ] Create **Realtime Database**
  - Go to: Realtime Database > Create Database
  - Start in **Production** mode
  - Choose your region

- [ ] Set Security Rules:
```json
{
  "rules": {
    "activeLocations": {
      "$driverId": {
        ".read": true,
        ".write": "auth.uid == $driverId"
      }
    }
  }
}
```

### Cloud Messaging (Optional)
- [ ] Enable **Cloud Messaging**
  - Go to: Cloud Messaging
  - Click "Enable" if prompted
  - Note your Sender ID (shown on the page)

## 🚀 Deployment Options

### Option 1: Firebase Hosting (Recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

### Option 2: GitHub Pages
1. Push to GitHub
2. Go to **Settings > Pages**
3. Select "Deploy from branch"
4. Choose main branch and /root folder
5. Site will be available at: `https://username.github.io/repo-name`

### Option 3: Custom Server
Deploy the entire folder to any web server supporting static files.

## 📱 Testing the Platform

### 1. Start Application
```bash
# Open in browser
file:///path/to/RapidReach/index.html
# Or start a local server
python -m http.server 8000
# Then visit: http://localhost:8000
```

### 2. Login Flow
1. Click "Get Started" on homepage
2. Enter test phone number (e.g., +1234567890)
3. Click "Send OTP"
4. Enter test OTP code
5. Select role: **Ambulance Driver** or **Public User**
6. Continue

### 3. Test Driver Dashboard
1. Login as **Ambulance Driver**
2. Click "Start Tracking"
3. Allow location access in browser
4. GPS tracking will begin
5. Location updates every 5 seconds
6. Open Realtime Database to verify data

### 4. Test Public Dashboard
1. Login as **Public User**
2. GPS will show your location
3. Enable driver to see ambulances
4. Click "Emergency Alert" to send alert

## 🔧 Troubleshooting

### "Firebase not initialized"
- ✅ Verify API key is correct in `config/firebase-config.js`
- ✅ Check browser console for error messages
- ✅ Ensure all Firebase services are enabled

### "reCAPTCHA error"
- ✅ Check reCAPTCHA is initialized in login.html
- ✅ Verify Google Cloud API is enabled for your project

### "Location permission denied"
- ✅ Check browser location permission settings
- ✅ HTTPS required for production (localhost is OK)
- ✅ User must grant permission when prompted

### "No ambulances showing"
- ✅ Verify driver has started tracking
- ✅ Check Realtime Database contains driver location data
- ✅ Ensure both users have location enabled

## 📊 Database Structure

### Firestore: /users/{uid}
```json
{
  "uid": "user-id",
  "mobileNumber": "+1234567890",
  "role": "driver",
  "createdAt": "timestamp",
  "lastLogin": "timestamp",
  "status": "active"
}
```

### Realtime Database: /activeLocations/{driverId}
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10,
  "altitude": 0,
  "heading": 90,
  "speed": 15,
  "timestamp": 1234567890000,
  "driverId": "driver-id"
}
```

## 🎯 Key Features

✅ **Phone Number Authentication**
- Real OTP SMS delivery via Firebase Auth
- Supports international numbers
- reCAPTCHA protection

✅ **Real-time GPS Tracking**
- Continuous location updates (5-second interval)
- High accuracy geolocation
- Stores in both Firestore and Realtime Database

✅ **Public User Tracking**
- See live ambulance locations
- Calculate distance to ambulances
- Estimated Time of Arrival (ETA)
- Emergency alerts

✅ **Map Integration**
- OpenStreetMap with Leaflet
- Works on GitHub Pages
- Real-time marker updates
- Multi-marker support

✅ **Mobile Responsive**
- Fully responsive design
- Touch-friendly controls
- Works on all devices

✅ **Offline Support**
- Service worker for caching
- PWA installation support
- Works offline (limited features)

## 📞 Support

For issues or questions:
1. Check console logs (F12 > Console)
2. Verify Firebase configuration
3. Check Firebase Console for data
4. Ensure all permissions are granted

---

**Last Updated**: 2024
**Status**: Production Ready ✅
