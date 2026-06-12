let map;
let ambulanceMarker;
let routePath = [];
let tripStartTime;
let tripDistance = 0;
let totalLocations = 0;

async function initDashboard() {
    // Check authentication
    if (!await window.routeProtection.checkAuthentication()) {
        return;
    }

    // Get user info
    const user = await window.routeProtection.getUserInfo();
    if (!user || user.role !== 'driver') {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userPhone').textContent = user.phoneNumber;

    // Initialize map
    initMap();

    // Setup location update listeners
    window.gpsTracker.onLocationUpdate((location) => {
        updateLocationUI(location);
        updateMapMarker(location);
        updateTripStats(location);
    });

    window.gpsTracker.onTrackingError((error) => {
        window.notificationSystem.sendNotification({
            type: 'warning',
            title: 'GPS Error',
            message: error.message
        });
    });

    // Listen for tracking events
    window.addEventListener('trackingStarted', () => {
        updateStatusUI('tracking');
    });

    window.addEventListener('trackingStopped', () => {
        updateStatusUI('idle');
    });
}

function initMap() {
    // Initialize with neutral/world view and show loading UI
    map = L.map('map').setView([0, 0], 2);
    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    document.getElementById('mapOverlay').style.display = 'block';
    document.getElementById('mapLoading').style.display = 'flex';

    tile.addTo(map);
    tile.on('load', () => {
        document.getElementById('mapOverlay').style.display = 'none';
        document.getElementById('mapLoading').style.display = 'none';
    });
}

async function startTracking() {
    try {
        window.notificationSystem.sendNotification({
            type: 'info',
            title: 'Starting GPS Tracking',
            message: 'Requesting location access...'
        });

        await window.gpsTracker.startTracking();
        tripStartTime = Date.now();
        tripDistance = 0;
        totalLocations = 0;
        routePath = [];

        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;

        window.notificationSystem.sendNotification({
            type: 'success',
            title: 'Tracking Started',
            message: 'Your location is now being tracked in real-time'
        });
    } catch (error) {
        window.notificationSystem.sendNotification({
            type: 'error',
            title: 'Tracking Error',
            message: error.message
        });
    }
}

async function stopTracking() {
    try {
        await window.gpsTracker.stopTracking();

        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;

        window.notificationSystem.sendNotification({
            type: 'success',
            title: 'Tracking Stopped',
            message: `Tracked ${totalLocations} locations`
        });
    } catch (error) {
        window.notificationSystem.sendNotification({
            type: 'error',
            title: 'Error',
            message: error.message
        });
    }
}

function emergencyMode() {
    window.notificationSystem.sendNotification({
        type: 'emergency',
        title: '🚨 Emergency Mode Activated',
        message: 'Emergency alert sent to nearby hospitals and responders',
        requireInteraction: true
    });

    window.notificationSystem.sendEmergencyAlert({
        latitude: window.gpsTracker.currentLocation?.latitude || 13.0827,
        longitude: window.gpsTracker.currentLocation?.longitude || 80.2707,
        type: 'emergency',
        description: 'Emergency mode activated by ambulance driver',
        severity: 'critical'
    });
}

function updateLocationUI(location) {
    document.getElementById('latitude').textContent = location.latitude.toFixed(6);
    document.getElementById('longitude').textContent = location.longitude.toFixed(6);
    document.getElementById('accuracy').textContent = location.accuracy.toFixed(1) + 'm';
    document.getElementById('speed').textContent = (location.speed || 0).toFixed(1) + ' m/s';
    document.getElementById('gpsStatus').textContent = 'Connected';

    totalLocations++;
    document.getElementById('locationCount').textContent = totalLocations;
}

function updateMapMarker(location) {
    if (ambulanceMarker) {
        ambulanceMarker.setLatLng([location.latitude, location.longitude]);
    } else {
        ambulanceMarker = L.marker([location.latitude, location.longitude], {
            icon: L.icon({
                iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Ctext y="50" font-size="60" font-weight="bold"%3E🚑%3C/text%3E%3C/svg%3E',
                iconSize: [40, 40]
            })
        }).addTo(map);
    }

    map.setView([location.latitude, location.longitude], 16);

    // Add to route path
    routePath.push([location.latitude, location.longitude]);
    if (routePath.length > 1) {
        const lastTwo = routePath.slice(-2);
        L.polyline(lastTwo, {
            color: '#DC143C',
            weight: 3,
            opacity: 0.7
        }).addTo(map);
    }
}

function updateTripStats(location) {
    if (routePath.length > 1) {
        const lastLocation = routePath[routePath.length - 2];
        const distance = window.gpsTracker.constructor.calculateDistance(
            lastLocation[0], lastLocation[1],
            location.latitude, location.longitude
        );
        tripDistance += distance;
    }

    const tripDurationSecs = Math.floor((Date.now() - tripStartTime) / 1000);
    const hours = Math.floor(tripDurationSecs / 3600);
    const minutes = Math.floor((tripDurationSecs % 3600) / 60);
    const seconds = tripDurationSecs % 60;

    document.getElementById('distance').textContent = (tripDistance / 1000).toFixed(2) + ' km';
    document.getElementById('duration').textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (tripDurationSecs > 0) {
        const avgSpeed = (tripDistance / tripDurationSecs) * 3.6; // Convert to km/h
        document.getElementById('avgSpeed').textContent = avgSpeed.toFixed(1) + ' km/h';
    }
}

function updateStatusUI(status) {
    const badge = document.getElementById('statusBadge');
    badge.textContent = status === 'tracking' ? 'Tracking...' : 'Idle';
    badge.className = `status-badge ${status === 'tracking' ? 'tracking' : 'idle'}`;
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        await window.routeProtection.logout();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);
