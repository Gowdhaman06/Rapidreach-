let map;
let userLocation;
let userMarker;
let ambulanceMarkers = {};
let selectedAmbulance = null;
let routeLine = null;

async function initDashboard() {
    // Check authentication
    if (!await window.routeProtection.checkAuthentication()) {
        return;
    }

    // Get user info
    const user = await window.routeProtection.getUserInfo();
    if (!user || user.role !== 'publicUser') {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userPhone').textContent = user.phoneNumber;

    // Initialize map
    initMap();

    // Get user location
    await getCurrentLocation();

    // Subscribe to ambulance updates
    subscribeToAmbulances();
}

// Configurable alert radius (meters)
const AMBULANCE_ALERT_RADIUS = 500; // default 500m
const alertedAmbulances = new Set();

function initMap() {
    // Initialize with a world view; will recenter when we have user or ambulance location
    map = L.map('map').setView([0, 0], 2);
    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    // Show loading overlay until tiles load
    document.getElementById('mapOverlay').style.display = 'block';
    document.getElementById('mapLoading').style.display = 'flex';

    tile.addTo(map);

    tile.on('load', () => {
        document.getElementById('mapOverlay').style.display = 'none';
        document.getElementById('mapLoading').style.display = 'none';
    });
}

async function getCurrentLocation() {
    try {
        const location = await window.gpsTracker.getCurrentLocation();
        userLocation = location;

        document.getElementById('userLat').textContent = location.latitude.toFixed(6);
        document.getElementById('userLng').textContent = location.longitude.toFixed(6);

        if (userMarker) {
            userMarker.setLatLng([location.latitude, location.longitude]);
        } else {
            userMarker = L.marker([location.latitude, location.longitude], {
                icon: L.icon({
                    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Ctext y="50" font-size="60" font-weight="bold"%3E🚗%3C/text%3E%3C/svg%3E',
                    iconSize: [35, 35]
                })
            }).addTo(map);
        }

        map.setView([location.latitude, location.longitude], 15);

        window.notificationSystem.sendNotification({
            type: 'success',
            title: 'Location Found',
            message: `Latitude: ${location.latitude.toFixed(4)}, Longitude: ${location.longitude.toFixed(4)}`
        });
    } catch (error) {
        window.notificationSystem.sendNotification({
            type: 'error',
            title: 'Location Error',
            message: error.message
        });
    }
}

function subscribeToAmbulances() {
    const realtimeDb = window.firebaseConfig.realtimeDb;

    realtimeDb.ref('activeLocations').on('value', (snapshot) => {
        const ambulances = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            if (data && userLocation) {
                const distance = window.gpsTracker.constructor.calculateDistance(
                    userLocation.latitude, userLocation.longitude,
                    data.latitude, data.longitude
                );

                if (distance < 5000) { // Within 5km
                    ambulances.push({
                        id: childSnapshot.key,
                        ...data,
                        distance: distance
                    });

                    updateAmbulanceMarker(data, childSnapshot.key);
                }
            }
        });

        updateAmbulanceList(ambulances.sort((a, b) => a.distance - b.distance));
    });
}

function updateAmbulanceMarker(ambulance, id) {
    if (ambulanceMarkers[id]) {
        ambulanceMarkers[id].setLatLng([ambulance.latitude, ambulance.longitude]);
    } else {
        ambulanceMarkers[id] = L.marker([ambulance.latitude, ambulance.longitude], {
            icon: L.icon({
                iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Ctext y="50" font-size="60" font-weight="bold"%3E🚑%3C/text%3E%3C/svg%3E',
                iconSize: [40, 40]
            })
        }).bindPopup(`<strong>Ambulance</strong><br/>Distance: ${(ambulance.distance / 1000).toFixed(1)} km<br/>Speed: ${ambulance.speed || 0} m/s`).addTo(map);
    }

    // Check alert radius (only if user location known)
    if (userLocation) {
        const dist = window.gpsTracker.constructor.calculateDistance(
            userLocation.latitude, userLocation.longitude,
            ambulance.latitude, ambulance.longitude
        );

        if (dist <= AMBULANCE_ALERT_RADIUS && !alertedAmbulances.has(id)) {
            alertedAmbulances.add(id);
            window.notificationSystem.sendNotification({
                type: 'warning',
                title: 'Ambulance Nearby',
                message: `Ambulance ${id.substr(0,8)} is within ${(dist).toFixed(0)} meters`,
                requireInteraction: false
            });
            window.notificationSystem.playAlertSound('warning');
        }
    }
}

function updateAmbulanceList(ambulances) {
    const listEl = document.getElementById('ambulanceList');
    const alertBanner = document.getElementById('alertBanner');

    if (ambulances.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-light);">
                <p>🔍 No ambulances nearby</p>
                <p style="font-size: 0.9rem;">Check back soon or call emergency services</p>
            </div>
        `;
        alertBanner.className = 'alert-banner safe';
        alertBanner.innerHTML = `
            <span>✅</span>
            <div>
                <strong>No Ambulances Nearby</strong>
                <div style="font-size: 0.9rem;">Call emergency services for urgent help</div>
            </div>
        `;
        return;
    }

    alertBanner.className = 'alert-banner nearby';
    alertBanner.innerHTML = `
        <span>⚠️</span>
        <div>
            <strong>${ambulances.length} Ambulance${ambulances.length !== 1 ? 's' : ''} Found</strong>
            <div style="font-size: 0.9rem;">Closest: ${(ambulances[0].distance / 1000).toFixed(1)} km away</div>
        </div>
    `;

    listEl.innerHTML = ambulances.map(amb => `
        <div class="ambulance-card ${selectedAmbulance === amb.id ? 'selected' : ''}" onclick="selectAmbulance('${amb.id}', ${amb.latitude}, ${amb.longitude})">
            <div class="ambulance-header">
                <span class="ambulance-title">🚑 Ambulance ${amb.id.substr(0, 8)}</span>
                <span class="ambulance-status available">Available</span>
            </div>
            <div class="ambulance-stats">
                <div class="stat">
                    <span class="stat-label">Distance</span>
                    <span class="stat-value">${(amb.distance / 1000).toFixed(1)} km</span>
                </div>
                <div class="stat">
                    <span class="stat-label">ETA</span>
                    <span class="stat-value">${formatETA(amb.distance)}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Speed</span>
                    <span class="stat-value">${(amb.speed || 0).toFixed(1)} m/s</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Accuracy</span>
                    <span class="stat-value">${(amb.accuracy || 0).toFixed(0)} m</span>
                </div>
            </div>
            <button class="request-btn" onclick="requestAmbulance('${amb.id}', event)">
                📞 Request This Ambulance
            </button>
        </div>
    `).join('');
}

function selectAmbulance(id, lat, lng) {
    selectedAmbulance = id;

    // Center map between user and ambulance if user location available
    if (userLocation) {
        const bounds = L.latLngBounds([
            [userLocation.latitude, userLocation.longitude],
            [lat, lng]
        ]);
        map.fitBounds(bounds.pad(0.3));

        // Draw route line
        if (routeLine) {
            map.removeLayer(routeLine);
        }
        routeLine = L.polyline([
            [userLocation.latitude, userLocation.longitude],
            [lat, lng]
        ], { color: '#3498DB', weight: 4, opacity: 0.8 }).addTo(map);

        // Calculate distance and ETA
        const distance = window.gpsTracker.constructor.calculateDistance(
            userLocation.latitude, userLocation.longitude, lat, lng
        );
        const etaSec = window.gpsTracker.constructor.calculateETA(distance);
        const etaText = window.gpsTracker.constructor.formatDuration(etaSec);

        // Show popup on ambulance marker if present
        if (ambulanceMarkers[id]) {
            ambulanceMarkers[id].bindPopup(`<strong>Ambulance ${id.substr(0,8)}</strong><br/>Distance: ${(distance/1000).toFixed(2)} km<br/>ETA: ${etaText}`).openPopup();
        }
    } else {
        map.setView([lat, lng], 16);
    }

    // Reload list to show selection
    subscribeToAmbulances();
}

function formatETA(distance) {
    const avgSpeed = 15; // m/s (54 km/h)
    const seconds = Math.round(distance / avgSpeed);
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
}

function requestAmbulance(ambulanceId, event) {
    event.stopPropagation();
    window.notificationSystem.sendNotification({
        type: 'success',
        title: 'Ambulance Requested',
        message: 'Ambulance driver has been notified and is on the way',
        requireInteraction: true
    });

    window.notificationSystem.playAlertSound('success');
}

function findHospitals() {
    window.location.href = 'hospital-list.html';
}

function reportEmergency() {
    if (confirm('Report emergency in your area?')) {
        window.notificationSystem.sendEmergencyAlert({
            latitude: userLocation?.latitude || 13.0827,
            longitude: userLocation?.longitude || 80.2707,
            type: 'emergency',
            description: 'Emergency reported by user',
            severity: 'critical'
        });

        window.notificationSystem.sendNotification({
            type: 'emergency',
            title: '🚨 Emergency Alert Sent',
            message: 'Emergency responders have been notified',
            requireInteraction: true
        });
    }
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        await window.routeProtection.logout();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);
