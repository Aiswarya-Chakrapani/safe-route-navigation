// server.js - Main API entry point
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { KDTree } = require('kd-tree-javascript');
const haversine = require('haversine-distance');
const cors = require('cors');

// Graph library for path finding
const { Graph } = require('./graph');

const app = express();
const port = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Global variables for storing crime data
let globalCrimeData = [];
let crimeBallTree = null;

/**
 * Helper function to load and process crime data
 * @param {string} filePath - Path to CSV file
 * @param {number} maxPoints - Maximum number of points to use
 * @returns {Promise<{crimeData: Array, crimeTree: Object}>}
 */
async function loadCrimeData(filePath, maxPoints = 1000) {
  return new Promise((resolve, reject) => {
    const crimeData = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        let lat, long;

        // Handle different column names
        if (row.lat !== undefined) lat = row.lat;
        else if (row.latitude !== undefined) lat = row.latitude;
        
        if (row.long !== undefined) long = row.long;
        else if (row.longitude !== undefined) long = row.longitude;
        else if (row.lon !== undefined) long = row.lon;
        
        lat = parseFloat(lat);
        long = parseFloat(long);
        
        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(long)) return;
        
        // Filter to Chennai area (optional)
        if (lat >= 12.7 && lat <= 13.2 && long >= 80.0 && long <= 80.3) {
          crimeData.push({
            id: row.id || crimeData.length,
            lat,
            long
          });
        }
      })
      .on('end', () => {
        // Sample data if too many points
        let sampledData = crimeData;
        if (crimeData.length > maxPoints) {
          // Simple random sampling
          sampledData = [];
          const sampleRate = maxPoints / crimeData.length;
          for (const item of crimeData) {
            if (Math.random() < sampleRate) {
              sampledData.push(item);
            }
            if (sampledData.length >= maxPoints) break;
          }
        }
        
        // Create a spatial index
        // Using KD-Tree for nearest neighbor search
        const tree = createKDTree(sampledData);
        
        console.log(`Loaded ${sampledData.length} crime points`);
        resolve({ crimeData: sampledData, crimeTree: tree });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

/**
 * Create a KD-Tree from crime data for spatial queries
 * @param {Array} data - Array of crime data points
 * @returns {Object} KD-Tree object
 */
function createKDTree(data) {
  // Convert crime data to format needed by KDTree
  const points = data.map(point => ({
    x: point.lat,
    y: point.long,
    id: point.id
  }));
  
  // Distance function for the KD tree (haversine)
  const distance = (a, b) => {
    return haversine(
      { latitude: a.x, longitude: a.y },
      { latitude: b.x, longitude: b.y }
    ) / 1000; // Convert to km
  };
  
  // Create and return the tree
  return new KDTree(points, distance, ['x', 'y']);
}

/**
 * Generate waypoints along a route
 * @param {number} srcLat - Source latitude
 * @param {number} srcLon - Source longitude
 * @param {number} dstLat - Destination latitude
 * @param {number} dstLon - Destination longitude
 * @param {number} numPoints - Number of waypoints to generate
 * @returns {Array} Array of waypoint coordinates
 */
function generateWaypoints(srcLat, srcLon, dstLat, dstLon, numPoints = 8) {
  console.log(`Generating ${numPoints} waypoints between source and destination`);
  
  // Calculate direct vector from source to destination
  const latDiff = dstLat - srcLat;
  const lonDiff = dstLon - srcLon;
  
  // Create waypoints with some random variation
  const waypoints = [];
  
  // Start with source
  waypoints.push({ lat: srcLat, lon: srcLon });
  
  // Generate intermediates
  for (let i = 1; i <= numPoints; i++) {
    // Base position along the route (0 to 1)
    const t = i / (numPoints + 1);
    
    // Basic linear interpolation
    const baseLat = srcLat + latDiff * t;
    const baseLon = srcLon + lonDiff * t;
    
    // Add some random variation
    // More variation in the middle, less at the ends
    const variationFactor = 0.03;  // controls the amount of deviation
    const variationScale = 4 * t * (1 - t);  // parabolic shape, max at t=0.5
    
    // Scale variation based on total distance
    const distance = haversine(
      { latitude: srcLat, longitude: srcLon },
      { latitude: dstLat, longitude: dstLon }
    ) / 1000; // Convert to km
    
    const variation = variationFactor * variationScale * distance;
    
    // Add some randomness
    const randomOffset = (Math.random() * 2 - 1) * variation;
    
    // Compute perpendicular direction
    let perpLat = -lonDiff;  // perpendicular to the direct path
    let perpLon = latDiff;
    
    // Normalize perpendicular vector
    const norm = Math.sqrt(perpLat**2 + perpLon**2);
    if (norm > 0) {
      perpLat /= norm;
      perpLon /= norm;
    }
    
    // Apply offset perpendicular to the direct route
    const waypointLat = baseLat + perpLat * randomOffset / 111.32;  // convert km to degrees
    const waypointLon = baseLon + perpLon * randomOffset / (111.32 * Math.cos(baseLat * Math.PI / 180));
    
    waypoints.push({ lat: waypointLat, lon: waypointLon });
  }
  
  // End with destination
  waypoints.push({ lat: dstLat, lon: dstLon });
  
  return waypoints;
}

/**
 * Create a graph from waypoints and apply crime penalties
 * @param {Array} waypoints - Array of waypoint coordinates
 * @param {Array} crimeData - Array of crime data points
 * @param {Object} crimeTree - KD-Tree for spatial queries
 * @param {number} numConnections - Number of additional connections
 * @returns {Object} Graph object
 */
function createWaypointGraph(waypoints, crimeData, crimeTree, numConnections = 2) {
  const G = new Graph();
  
  // Add nodes for all waypoints
  for (let i = 0; i < waypoints.length; i++) {
    G.addNode(i, { 
      y: waypoints[i].lat, 
      x: waypoints[i].lon 
    });
  }
  
  // Create primary path through all waypoints
  for (let i = 0; i < waypoints.length - 1; i++) {
    // Distance for direct connection
    const dist = haversine(
      { latitude: waypoints[i].lat, longitude: waypoints[i].lon },
      { latitude: waypoints[i+1].lat, longitude: waypoints[i+1].lon }
    );
    G.addEdge(i, i+1, { length: dist, type: 'primary' });
  }
  
  // Add additional connections between waypoints
  const maxForwardSkip = Math.min(numConnections, waypoints.length - 1);
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    // Add forward connections (skip some nodes)
    for (let j = i+2; j < Math.min(i+maxForwardSkip+2, waypoints.length); j++) {
      // Distance for this connection
      const dist = haversine(
        { latitude: waypoints[i].lat, longitude: waypoints[i].lon },
        { latitude: waypoints[j].lat, longitude: waypoints[j].lon }
      );
      
      // Only add if distance is not too much longer than going through nodes
      const directDist = haversine(
        { latitude: waypoints[i].lat, longitude: waypoints[i].lon },
        { latitude: waypoints[i+1].lat, longitude: waypoints[i+1].lon }
      );
      
      if (dist < directDist * 2.5) {  // limit to 2.5x direct distance
        G.addEdge(i, j, { length: dist, type: 'secondary' });
      }
    }
  }
  
  // Apply crime penalties if crime data is available
  if (crimeTree && crimeData && crimeData.length > 0) {
    const radiusKm = 0.4;  // 400m radius around crime points
    let penaltyCount = 0;
    
    // Apply penalties to edges
    for (const [u, v, data] of G.edges()) {
      try {
        if (!('length' in data)) continue;
        
        // Get edge endpoints
        const uNode = G.getNode(u);
        const vNode = G.getNode(v);
        
        // Check multiple points along the edge
        const checkPoints = [];
        for (const t of [0.25, 0.5, 0.75]) {  // 3 points along the edge
          const lat = uNode.y + (vNode.y - uNode.y) * t;
          const lon = uNode.x + (vNode.x - uNode.x) * t;
          checkPoints.push({ lat, lon });
        }
        
        // Check each point for crime proximity
        let maxPenalty = 1.0;
        for (const point of checkPoints) {
          // Find crimes within radius
          const nearbyPoints = findCrimesNear(point.lat, point.lon, radiusKm, crimeData, crimeTree);
          
          if (nearbyPoints.length > 0) {
            // Calculate distance to nearest crime
            let minDist = Infinity;
            for (const crime of nearbyPoints) {
              const dist = haversine(
                { latitude: point.lat, longitude: point.lon },
                { latitude: crime.lat, longitude: crime.long }
              ) / 1000; // Convert to km
              
              minDist = Math.min(minDist, dist);
            }
            
            // Penalty based on proximity
            if (minDist < radiusKm) {
              // Higher penalty for closer crimes
              const pointPenalty = 2.0 + (radiusKm - minDist) / radiusKm * 3.0;  // 2-5x penalty
              maxPenalty = Math.max(maxPenalty, pointPenalty);
            }
          }
        }
        
        // Apply the highest penalty found
        if (maxPenalty > 1.0) {
          G.updateEdge(u, v, { length: data.length * maxPenalty });
          penaltyCount++;
        }
      } catch (err) {
        console.error(`Error processing edge ${u}-${v}:`, err);
        continue;  // Skip problematic edges
      }
    }
    
    console.log(`Applied penalties to ${penaltyCount} edges`);
  }
  
  return G;
}

/**
 * Find crimes near a point using the KD tree
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @param {Array} crimeData - Array of crime data points
 * @param {Object} crimeTree - KD-Tree for spatial queries
 * @returns {Array} Array of nearby crime points
 */
function findCrimesNear(lat, lon, radiusKm, crimeData, crimeTree) {
  try {
    // Find nearest points within radius
    const point = { x: lat, y: lon };
    const nearestPoints = crimeTree.nearest(point, 50, radiusKm);
    return nearestPoints.map(entry => {
      const idx = crimeData.findIndex(crime => crime.id === entry[0].id);
      return idx >= 0 ? crimeData[idx] : null;
    }).filter(x => x !== null);
  } catch (err) {
    console.error('Error in findCrimesNear:', err);
    return [];
  }
}

/**
 * Find optimal route
 * @param {Object} G - Graph object
 * @returns {Array} Array of node IDs representing the route
 */
function findOptimalRoute(G) {
  // Source is first node (0), destination is last node
  const startNode = 0;
  const endNode = G.nodeCount() - 1;
  
  try {
    const route = G.shortestPath(startNode, endNode);
    console.log(`Found optimal route with ${route.length} nodes`);
    return route;
  } catch (err) {
    console.error('Error finding route:', err);
    return [startNode, endNode];  // Fallback direct route
  }
}

/**
 * Calculate the total distance of the route in km
 * @param {Object} G - Graph object
 * @param {Array} route - Array of node IDs
 * @returns {number} Distance in kilometers
 */
function calculateRouteDistance(G, route) {
  try {
    let totalDist = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const u = route[i];
      const v = route[i+1];
      const edgeData = G.getEdge(u, v);
      totalDist += edgeData.length;
    }
    
    // Convert to km
    return totalDist / 1000;
  } catch (err) {
    console.error('Error calculating distance:', err);
    return 0;
  }
}

/**
 * Create Google Maps URL from route
 * @param {Object} G - Graph object
 * @param {Array} route - Array of node IDs
 * @returns {string} Google Maps URL
 */
function createGoogleMapsUrl(G, route) {
  const baseUrl = "https://www.google.com/maps/dir/";
  
  // Add all points
  const pathCoords = [];
  for (const nodeId of route) {
    const node = G.getNode(nodeId);
    pathCoords.push(`${node.y},${node.x}`);
  }
  
  // Join with slashes
  return baseUrl + pathCoords.join('/') + '/';
}

/**
 * Calculate a safe route between two points
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
app.post('/api/route', upload.single('crimeData'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Extract coordinates from request
    const { sourceLat, sourceLon, destLat, destLon } = req.body;
    
    // Validate inputs
    if (!sourceLat || !sourceLon || !destLat || !destLon) {
      return res.status(400).json({ error: 'Missing required coordinates' });
    }
    
    // Parse coordinates
    const srcLat = parseFloat(sourceLat);
    const srcLon = parseFloat(sourceLon);
    const dstLat = parseFloat(destLat);
    const dstLon = parseFloat(destLon);
    
    // Validate coordinate ranges
    if (srcLat < -90 || srcLat > 90 || srcLon < -180 || srcLon > 180 || 
        dstLat < -90 || dstLat > 90 || dstLon < -180 || dstLon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    let crimeData, crimeTree;
    
    // Use global crime data if available and no file uploaded
    if (globalCrimeData.length > 0 && crimeBallTree && !req.file) {
      console.log('Using cached crime data');
      crimeData = globalCrimeData;
      crimeTree = crimeBallTree;
    } else if (req.file) {
      // Process uploaded file
      console.log('Processing uploaded crime data');
      const filePath = req.file.path;
      const { crimeData: newCrimeData, crimeTree: newCrimeTree } = await loadCrimeData(filePath);
      crimeData = newCrimeData;
      crimeTree = newCrimeTree;
      
      // Cache the data for future requests
      globalCrimeData = newCrimeData;
      crimeBallTree = newCrimeTree;
      
      // Clean up the file
      fs.unlink(filePath, err => {
        if (err) console.error('Error deleting temp file:', err);
      });
    } else {
      console.log('No crime data available');
      crimeData = [];
      crimeTree = null;
    }
    
    // Generate waypoints
    const waypoints = generateWaypoints(srcLat, srcLon, dstLat, dstLon, 8);
    
    // Create graph with crime penalties
    const G = createWaypointGraph(waypoints, crimeData, crimeTree, 3);
    
    // Find optimal route
    const route = findOptimalRoute(G);
    
    // Calculate route distance
    const distanceKm = calculateRouteDistance(G, route);
    
    // Create Google Maps URL
    const googleMapsUrl = createGoogleMapsUrl(G, route);
    
    // Extract waypoints along the route
    const routeWaypoints = route.map(nodeId => {
      const node = G.getNode(nodeId);
      return {
        lat: node.y,
        lon: node.x
      };
    });
    
    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000;
    
    // Return the response
    res.json({
      success: true,
      processingTime,
      route: {
        waypoints: routeWaypoints,
        distance: distanceKm,
        googleMapsUrl
      }
    });
    
  } catch (err) {
    console.error('Error processing request:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Serve static HTML for testing the API
app.use(express.static('public'));
// Add a simple test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
  });
  // Add this code to your server.js before app.listen()
app.post('/api/route-test', express.json(), (req, res) => {
    console.log("Route test received:", req.body);
    res.json({
      success: true,
      message: "Route test successful",
      receivedData: req.body
    });
  });
// Start the server
app.listen(port, () => {
  console.log(`Safe Route API listening at http://localhost:${port}`);
});