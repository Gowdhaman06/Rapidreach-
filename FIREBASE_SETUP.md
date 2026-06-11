# Firebase Setup Guide for RapidReach

## ⚠️ Why Nothing is Working

**The application requires Firebase credentials to function.** Currently, `config/firebase-config.js` has placeholder values. You need to add your actual Firebase project credentials.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"**
3. Enter project name: **RapidReach**
4. Select your country
5. Click **"Create project"** and wait for completion

### Step 2: Enable Firebase Services

In your Firebase project console:

1. **Enable Phone Authentication**
   - Go to: Build → Authentication
   - Click "Get Started"
   - Select "Phone" provider
   - Enable it

2. **Create Firestore Database**
   - Go to: Build → Firestore Database
   - Click "Create Database"
   - Start in **Production mode** (we'll set rules later)
   - Select your region

3. **Create Realtime Database**
   - Go to: Build → Realtime Database
   - Click "Create Database"
   - Select your region
   - Start with **locked mode** (we'll set rules later)

4. **Enable Cloud Messaging (Optional)**
   - Go to: Build → Messaging
   - It should be enabled automatically

### Step 3: Get Your Firebase Credentials

1. Go to: Project Settings (⚙️ icon)
2. Scroll down to "Your apps"
3. Click **"</> Web"** icon
4. Click **"Config"** in the "Firebase SDK snippet"
5. Copy your config object that looks like:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:xxxxxxxxxxxx",
    databaseURL: "https://your-project.firebaseio.com"
};
```

### Step 4: Update config/firebase-config.js

Replace the placeholder config with your credentials:

```bash
# Open: config/firebase-config.js
# Replace the firebaseConfig object with your credentials
```

**Before (Current):**
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    authDomain: "rapidreach-xxxxx.firebaseapp.com",
    projectId: "rapidreach-xxxxx",
    ...
};
```

**After (Your config):**
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyD1234567890abcdefghijklmnop",
    authDomain: "myrapidreach.firebaseapp.com",
    projectId: "myrapidreach-proj",
    ...
};
```

### Step 5: Set Firebase Security Rules

#### Firestore Rules

1. Go to: Firestore Database → Rules tab
2. Replace all content with:

```json
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
    }
    match /ambulances/{ambulanceId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == get(/databases/$(database)/documents/ambulances/$(ambulanceId)).data.driverId;
    }
    match /hospitals/{hospitalId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == get(/databases/$(database)/documents/hospitals/$(hospitalId)).data.adminId;
    }
    match /emergencyAlerts/{alertId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /trips/{tripId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == get(/databases/$(database)/documents/trips/$(tripId)).data.userId;
    }
  }
}
```

3. Click **"Publish"**

#### Realtime Database Rules

1. Go to: Realtime Database → Rules tab
2. Replace all content with:

```json
{
  "rules": {
    "ambulances": {
      "$ambulanceId": {
        ".read": true,
        ".write": "root.child('ambulances').child($ambulanceId).child('driverId').val() === auth.uid",
        "location": {
          ".validate": "newData.hasChildren(['latitude', 'longitude'])"
        }
      }
    },
    "hospitals": {
      "$hospitalId": {
        ".read": true,
        ".write": "root.child('hospitals').child($hospitalId).child('adminId').val() === auth.uid"
      }
    },
    "emergencyAlerts": {
      ".read": true,
      ".write": "auth != null"
    },
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

3. Click **"Publish"**

### Step 6: Test the Application

1. Refresh your browser
2. Check browser console (F12) for Firebase initialization confirmation
3. You should see: **"✅ Firebase initialized successfully"**

## ✅ How to Verify It's Working

### In Browser Console (F12):
```
✅ Firebase initialized successfully
✅ Firestore initialized
✅ Realtime Database ready
```

### Test Authentication:
1. Go to `login.html`
2. Enter your phone number (e.g., +919876543210)
3. Click "Send OTP"
4. Check Firebase Console → Authentication to see the sign-up request

### Test Location Tracking:
1. After login, go to driver dashboard
2. Click "Start Tracking"
3. Grant location permission
4. You should see live coordinates updating

## 🐛 Troubleshooting

### "Firebase initialization error"
- **Solution**: Check your credentials in `config/firebase-config.js` are correct
- Verify they match your Firebase project settings

### "Phone authentication not working"
- **Solution**: Go to Firebase Console → Authentication → Phone
- Verify "Phone" provider is enabled
- Check that you've set up billing (Firebase requires it for phone auth)

### "Map not showing"
- **Solution**: Check that Leaflet library is loading
- Open DevTools and look for 404 errors on CDN resources
- Ensure internet connection is working

### "No location data appearing"
- **Solution**: 
  1. Check browser location permissions
  2. Ensure GPS is enabled on your device
  3. Check Realtime Database rules allow write access
  4. Check browser console for GPS errors

### "Can't see other ambulances"
- **Solution**:
  1. Make sure other drivers have tracking enabled
  2. Check Realtime Database → Data tab to see actual data
  3. Verify Firestore/Realtime DB rules are correctly set

## 📱 Testing with Multiple Users

1. Open application in multiple browsers/tabs
2. Login as different users with different phone numbers
3. Start tracking on driver accounts
4. Check if locations appear in other dashboards

## 🔒 Important Security Notes

- **Never commit** `config/firebase-config.js` with real credentials to Git
- Use `.env` files in production
- Restrict API key to your domain in Firebase Console
- Regularly review Firebase security rules
- Monitor Firebase usage for unexpected costs

## 📞 Support

If you get stuck:
1. Check browser console (F12) for specific error messages
2. Review Firebase error messages
3. Verify all credentials are correctly copied
4. Make sure Firestore and Realtime Database are created
5. Check that phone auth is enabled

---

**After completing this setup, your RapidReach application will be fully functional!**
