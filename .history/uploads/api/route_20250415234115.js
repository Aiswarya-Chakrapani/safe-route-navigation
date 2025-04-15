import haversine from 'haversine-distance';

// Sample crime data (you can expand this)
const crimeData = [
  { id: 1, lat: 12.9856, long: 80.2001 },
  { id: 2, lat: 13.0021, long: 80.2153 },
  { id: 3, lat: 12.9634, long: 80.1902 },
  { id: 4, lat: 12.9723, long: 80.2145 },
  { id: 5, lat: 13.0523, long: 80.2198 }
];

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get coordinates from request body
    const { sourceLat, sourceLon, destLat, destLon } = req.body;
    
    // Validate inputs
    if (!sourceLat || !sourceLon || !destLat || !destLon) {
      return res.status(400).json({ error: 'Missing required coordinates' });
    }
    
    // Generate waypoints
    const waypoints = generateWaypoints(sourceLat, sourceLon, destLat, destLon, 8);
    
    // Generate Google Maps URL with waypoints
    let googleMapsUrl = "https://www.google.com/maps/dir/";
    waypoints.forEach(wp => {
      googleMapsUrl += `${wp.lat},${wp.lon}/`;
    });
    
    // Return only the Google Maps URL
    return res.status(200).json({ googleMapsUrl });
    
  } catch (err) {
    console.error('Error:', err);
    
    // Fallback - create a direct Google Maps URL
    const { sourceLat, sourceLon, destLat, destLon } = req.body;
    const fallbackUrl = `https://www.google.com/maps/dir/${sourceLat},${sourceLon}/${destLat},${destLon}/`;
    
    return res.status(200).json({ googleMapsUrl: fallbackUrl });
  }
}

// Function to generate waypoints with some variation
function generateWaypoints(srcLat, srcLon, dstLat, dstLon, numPoints = 8) {
  // Parse coordinates to ensure they're numbers
  const sourceLat = parseFloat(srcLat);
  const sourceLon = parseFloat(srcLon);
  const destLat = parseFloat(dstLat);
  const destLon = parseFloat(dstLon);
  
  // If invalid coordinates, return direct route
  if (isNaN(sourceLat) || isNaN(sourceLon) || isNaN(destLat) || isNaN(destLon)) {
    return [
      { lat: sourceLat || 0, lon: sourceLon || 0 },
      { lat: destLat || 0, lon: destLon || 0 }
    ];
  }
  
  // Calculate direct vector
  const latDiff = destLat - sourceLat;
  const lonDiff = destLon - sourceLon;
  
  // Create waypoints array
  const waypoints = [];
  
  // Start with source
  waypoints.push({ lat: sourceLat, lon: sourceLon });
  
  // Generate intermediate waypoints
  for (let i = 1; i <= numPoints; i++) {
    // Position along the route (0 to 1)
    const t = i / (numPoints + 1);
    
    // Basic linear interpolation
    const baseLat = sourceLat + latDiff * t;
    const baseLon = sourceLon + lonDiff * t;
    
    // Add some random variation
    const variationFactor = 0.03;
    const variationScale = 4 * t * (1 - t); // More variation in the middle
    
    // Calculate direct distance for scaling
    const distance = calculateDistance(
      { latitude: sourceLat, longitude: sourceLon },
      { latitude: destLat, longitude: destLon }
    ) / 1000; // Convert to km
    
    const variation = variationFactor * variationScale * distance;
    const randomOffset = (Math.random() * 2 - 1) * variation;
    
    // Calculate perpendicular direction
    let perpLat = -lonDiff;
    let perpLon = latDiff;
    
    // Normalize
    const norm = Math.sqrt(perpLat**2 + perpLon**2);
    if (norm > 0) {
      perpLat /= norm;
      perpLon /= norm;
    }
    
    // Apply offset perpendicular to route
    const waypointLat = baseLat + perpLat * randomOffset / 111.32;
    const waypointLon = baseLon + perpLon * randomOffset / (111.32 * Math.cos(baseLat * Math.PI / 180));
    
    waypoints.push({ lat: waypointLat, lon: waypointLon });
  }
  
  // End with destination
  waypoints.push({ lat: destLat, lon: destLon });
  
  return waypoints;
}

// Simple distance calculation
function calculateDistance(point1, point2) {
  return haversine(point1, point2);
}