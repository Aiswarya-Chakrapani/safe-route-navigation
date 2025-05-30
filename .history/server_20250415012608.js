<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe Route Planner</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            background-color: #4CAF50;
            color: white;
            padding: 1rem;
            text-align: center;
            border-radius: 5px;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .control-panel {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"], input[type="file"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .coords-container {
            display: flex;
            gap: 10px;
        }
        .coords-container input {
            flex: 1;
        }
        button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #45a049;
        }
        button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        #map {
            height: 500px;
            width: 100%;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .loading {
            text-align: center;
            padding: 20px;
            display: none;
        }
        .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 4px solid #4CAF50;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .result-panel {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            margin-top: 20px;
            display: none;
        }
        .result-detail {
            margin-bottom: 10px;
        }
        .google-maps-link {
            display: inline-block;
            margin-top: 10px;
            padding: 8px 15px;
            background-color: #4285F4;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
        }
        .google-maps-link:hover {
            background-color: #3367D6;
        }
        .error-message {
            color: #ff0000;
            margin-top: 10px;
            display: none;
            padding: 10px;
            background-color: #ffeeee;
            border-radius: 4px;
            border-left: 4px solid #ff0000;
        }
        .example-coords {
            margin-top: 10px;
            font-size: 0.9em;
            color: #666;
        }
        .coords-preset {
            padding: 2px 8px;
            background-color: #f0f0f0;
            border-radius: 3px;
            cursor: pointer;
            display: inline-block;
            margin-right: 10px;
        }
        .coords-preset:hover {
            background-color: #e0e0e0;
        }
        .debug-info {
            margin-top: 20px;
            font-size: 0.8em;
            color: #666;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1><i class="fas fa-route"></i> Safe Route Planner</h1>
            <p>Find the safest route between two locations based on crime data</p>
        </header>

        <div class="control-panel">
            <div class="form-group">
                <label for="crime-data">Upload Crime Data (CSV file with lat/long columns):</label>
                <input type="file" id="crime-data" accept=".csv">
                <div class="example-coords">
                    Optional: If no file is uploaded, the last uploaded data will be used
                </div>
            </div>

            <div class="form-group">
                <label for="source-coords">Source Coordinates:</label>
                <div class="coords-container">
                    <input type="text" id="source-lat" placeholder="Latitude">
                    <input type="text" id="source-lon" placeholder="Longitude">
                </div>
                <div class="example-coords">
                    Example: <span class="coords-preset" data-lat="12.8259" data-lon="80.0395">12.8259, 80.0395</span>
                </div>
            </div>

            <div class="form-group">
                <label for="dest-coords">Destination Coordinates:</label>
                <div class="coords-container">
                    <input type="text" id="dest-lat" placeholder="Latitude">
                    <input type="text" id="dest-lon" placeholder="Longitude">
                </div>
                <div class="example-coords">
                    Example: <span class="coords-preset" data-lat="13.0843" data-lon="80.2705">13.0843, 80.2705</span>
                </div>
            </div>

            <button id="calculate-route">Calculate Safe Route</button>
            <div id="error-message" class="error-message"></div>
        </div>

        <div id="loading" class="loading">
            <div class="spinner"></div>
            <p>Calculating safe route...</p>
        </div>

        <div id="map"></div>

        <div id="result-panel" class="result-panel">
            <h2>Route Information</h2>
            <div class="result-detail">
                <strong>Distance:</strong> <span id="route-distance">0</span> km
            </div>
            <div class="result-detail">
                <strong>Processing Time:</strong> <span id="processing-time">0</span> seconds
            </div>
            <div class="result-detail">
                <strong>Waypoints:</strong> <span id="waypoint-count">0</span>
            </div>
            <a id="google-maps-link" href="#" target="_blank" class="google-maps-link">
                <i class="fab fa-google"></i> Open in Google Maps
            </a>
        </div>
        
        <div id="debug-info" class="debug-info"></div>
    </div>

    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script>
        // Initialize map
        const map = L.map('map').setView([13.0, 80.2], 10); // Chennai area

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // UI elements
        const calculateButton = document.getElementById('calculate-route');
        const loadingIndicator = document.getElementById('loading');
        const resultPanel = document.getElementById('result-panel');
        const errorMessage = document.getElementById('error-message');
        const routeDistance = document.getElementById('route-distance');
        const processingTime = document.getElementById('processing-time');
        const waypointCount = document.getElementById('waypoint-count');
        const googleMapsLink = document.getElementById('google-maps-link');
        const debugInfo = document.getElementById('debug-info');

        // Route layer
        let routeLayer = null;
        let waypointMarkers = [];

        // Add event listeners for preset coordinates
        document.querySelectorAll('.coords-preset').forEach(preset => {
            preset.addEventListener('click', function() {
                const lat = this.getAttribute('data-lat');
                const lon = this.getAttribute('data-lon');
                const parentDiv = this.closest('.form-group');
                
                if (parentDiv.querySelector('label').htmlFor === 'source-coords') {
                    document.getElementById('source-lat').value = lat;
                    document.getElementById('source-lon').value = lon;
                } else {
                    document.getElementById('dest-lat').value = lat;
                    document.getElementById('dest-lon').value = lon;
                }
            });
        });

        // Calculate route
        calculateButton.addEventListener('click', async function() {
            // Get input values
            const sourceLat = document.getElementById('source-lat').value.trim();
            const sourceLon = document.getElementById('source-lon').value.trim();
            const destLat = document.getElementById('dest-lat').value.trim();
            const destLon = document.getElementById('dest-lon').value.trim();
            const crimeDataFile = document.getElementById('crime-data').files[0];

            // Validate inputs
            if (!sourceLat || !sourceLon || !destLat || !destLon) {
                showError('Please enter all coordinates');
                return;
            }

            // Clear previous results
            clearMap();
            hideError();
            showLoading();

            try {
                // Prepare form data
                const formData = new FormData();
                formData.append('sourceLat', sourceLat);
                formData.append('sourceLon', sourceLon);
                formData.append('destLat', destLat);
                formData.append('destLon', destLon);
                
                if (crimeDataFile) {
                    formData.append('crimeData', crimeDataFile);
                }

                debugInfo.innerHTML = "Sending request to API...";
                debugInfo.style.display = 'block';
                
                // Call API
                const response = await fetch('/api/route', {
                    method: 'POST',
                    body: formData
                });

                debugInfo.innerHTML += "<br>Response received, status: " + response.status;
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to calculate route');
                }

                const data = await response.json();
                debugInfo.innerHTML += "<br>Data received, success: " + data.success;
                
                if (data.error) {
                    throw new Error(data.error);
                }

                displayRoute(data);
            } catch (error) {
                console.error("Error:", error);
                showError(error.message || "Failed to calculate route");
                
                // Show a direct route as fallback
                if (isValidCoordinate(sourceLat) && isValidCoordinate(sourceLon) && 
                    isValidCoordinate(destLat) && isValidCoordinate(destLat)) {
                    showDirectRoute(sourceLat, sourceLon, destLat, destLon);
                }
            } finally {
                hideLoading();
            }
        });

        function displayRoute(data) {
            // Show result panel
            resultPanel.style.display = 'block';
            
            // Update stats
            routeDistance.textContent = data.route.distance.toFixed(2);
            processingTime.textContent = data.processingTime.toFixed(2);
            waypointCount.textContent = data.route.waypoints.length;
            googleMapsLink.href = data.route.googleMapsUrl;
            
            // Draw route on map
            const routeCoordinates = data.route.waypoints.map(wp => [wp.lat, wp.lon]);
            
            // Add route polyline
            routeLayer = L.polyline(routeCoordinates, {
                color: 'green',
                weight: 5,
                opacity: 0.7
            }).addTo(map);
            
            // Add markers for source and destination
            const sourceMarker = L.marker(routeCoordinates[0], {
                icon: L.divIcon({
                    html: '<i class="fas fa-play" style="color: green; font-size: 20px;"></i>',
                    className: 'map-icon',
                    iconSize: [20, 20]
                })
            }).addTo(map);
            waypointMarkers.push(sourceMarker);
            
            const destMarker = L.marker(routeCoordinates[routeCoordinates.length - 1], {
                icon: L.divIcon({
                    html: '<i class="fas fa-flag-checkered" style="color: red; font-size: 20px;"></i>',
                    className: 'map-icon',
                    iconSize: [20, 20]
                })
            }).addTo(map);
            waypointMarkers.push(destMarker);
            
            // Add small circles for waypoints
            for (let i = 1; i < routeCoordinates.length - 1; i++) {
                const wpMarker = L.circleMarker(routeCoordinates[i], {
                    radius: 4,
                    color: 'blue',
                    fillColor: 'blue',
                    fillOpacity: 1
                }).addTo(map);
                waypointMarkers.push(wpMarker);
            }
            
            // Fit map to route
            map.fitBounds(routeLayer.getBounds(), {
                padding: [50, 50]
            });
        }

        function showDirectRoute(srcLat, srcLon, dstLat, dstLon) {
            const routeCoordinates = [
                [srcLat, srcLon],
                [dstLat, dstLon]
            ];
            
            routeLayer = L.polyline(routeCoordinates, {
                color: 'blue',
                weight: 5,
                opacity: 0.7,
                dashArray: '10,10',
                lineJoin: 'round'
            }).addTo(map);
            
            // Add markers
            const sourceMarker = L.marker([srcLat, srcLon], {
                title: "Start"
            }).addTo(map);
            
            const destMarker = L.marker([dstLat, dstLon], {
                title: "Destination"
            }).addTo(map);
            
            // Store markers
            waypointMarkers.push(sourceMarker);
            waypointMarkers.push(destMarker);
            
            // Fit map to route
            map.fitBounds(routeLayer.getBounds(), {
                padding: [50, 50]
            });
            
            // Show direct route message and stats
            showError("Could not calculate optimized route. Showing direct route instead.");
            
            // Calculate straight-line distance
            const distance = calculateHaversineDistance(srcLat, srcLon, dstLat, dstLon);
            
            // Update result panel
            resultPanel.style.display = 'block';
            routeDistance.textContent = distance.toFixed(2);
            waypointCount.textContent = '2';
            googleMapsLink.href = `https://www.google.com/maps/dir/${srcLat},${srcLon}/${dstLat},${dstLon}/`;
        }

        // Helper function to calculate distance
        function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
            const R = 6371; // Earth radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }

        // Helper function to validate coordinates
        function isValidCoordinate(coord) {
            const num = parseFloat(coord);
            return !isNaN(num);
        }

        function clearMap() {
            // Remove previous route layer
            if (routeLayer) {
                map.removeLayer(routeLayer);
                routeLayer = null;
            }
            
            // Remove waypoint markers
            waypointMarkers.forEach(marker => map.removeLayer(marker));
            waypointMarkers = [];
            
            // Hide result panel
            resultPanel.style.display = 'none';
        }

        function showLoading() {
            loadingIndicator.style.display = 'block';
            calculateButton.disabled = true;
        }

        function hideLoading() {
            loadingIndicator.style.display = 'none';
            calculateButton.disabled = false;
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }

        function hideError() {
            errorMessage.style.display = 'none';
        }

        // Initial setup - auto-fill with example coordinates
        document.getElementById('source-lat').value = '12.8259';
        document.getElementById('source-lon').value = '80.0395';
        document.getElementById('dest-lat').value = '13.0843';
        document.getElementById('dest-lon').value = '80.2705';
    </script>
</body>
</html>