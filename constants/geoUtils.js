/**
 * Geo & Vicinity calculation utilities for GreenTrace
 */

/**
 * Calculates great-circle distance between two geographic coordinates in meters using the Haversine formula.
 * @param {number|string} lat1
 * @param {number|string} lon1
 * @param {number|string} lat2
 * @param {number|string} lon2
 * @returns {number} distance in meters, or Infinity if invalid
 */
export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    Number.isNaN(nLat1) ||
    Number.isNaN(nLon1) ||
    Number.isNaN(nLat2) ||
    Number.isNaN(nLon2)
  ) {
    return Infinity;
  }

  const R = 6371e3; // Earth's radius in meters
  const phi1 = (nLat1 * Math.PI) / 180;
  const phi2 = (nLat2 * Math.PI) / 180;
  const deltaPhi = ((nLat2 - nLat1) * Math.PI) / 180;
  const deltaLambda = ((nLon2 - nLon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Safely extracts latitude and longitude numbers from an object or coordinate container.
 * @param {any} obj 
 * @returns {{ latitude: number, longitude: number } | null}
 */
export function extractCoordinates(obj) {
  if (!obj) return null;
  const lat =
    obj.coordinates?.latitude ??
    obj.latitude ??
    obj.lat ??
    obj.coords?.latitude;
  const lng =
    obj.coordinates?.longitude ??
    obj.longitude ??
    obj.lng ??
    obj.lon ??
    obj.coords?.longitude;

  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isNaN(nLat) || Number.isNaN(nLng)) return null;
  return { latitude: nLat, longitude: nLng };
}

export const VICINITY_RADIUS_METERS = 30; // 30-meter proximity threshold

/**
 * Checks whether two reports or candidate coordinates are in the same immediate vicinity.
 * Strict check: GPS distance <= threshold (default 30m).
 * If both reports have GPS coordinates, the 30-meter GPS distance is strictly authoritative.
 * Distance > 30m will NEVER be flagged as a duplicate.
 */
export function checkVicinity(candidate, existing, radiusMeters = VICINITY_RADIUS_METERS) {
  if (!candidate || !existing) return { isVicinity: false, distanceMeters: null };

  const candCoords = extractCoordinates(candidate);
  const existCoords = extractCoordinates(existing);

  // 1. Strict GPS check if both coordinates exist
  if (candCoords && existCoords) {
    const distance = getDistanceInMeters(
      candCoords.latitude,
      candCoords.longitude,
      existCoords.latitude,
      existCoords.longitude
    );

    if (distance <= radiusMeters) {
      return {
        isVicinity: true,
        distanceMeters: Math.round(distance),
        method: "gps",
      };
    }

    // Explicitly out of range (> 30 meters) -> NOT in vicinity!
    // Do NOT fall back to Purok text match when GPS shows they are far apart.
    return {
      isVicinity: false,
      distanceMeters: Math.round(distance),
      method: "gps_out_of_range",
    };
  }

  // 2. Fallback check ONLY when GPS is completely missing on either record
  const candB = (candidate.barangay || "").toLowerCase().trim();
  const existB = (existing.barangay || "").toLowerCase().trim();
  const candP = (candidate.purok || "")
    .toLowerCase()
    .trim()
    .replace(/^purok\s*|^pk\.?\s*/i, "");
  const existP = (existing.purok || "")
    .toLowerCase()
    .trim()
    .replace(/^purok\s*|^pk\.?\s*/i, "");

  // Ignore generic names like "pinamungajan" or "poblacion" as purok to prevent false matches
  const isGeneric =
    !candP ||
    candP === "pinamungajan" ||
    candP === "poblacion" ||
    candP === "none" ||
    candP === "n/a";

  if (!isGeneric && candB && existB && candB === existB && candP && existP && candP === existP) {
    return {
      isVicinity: true,
      distanceMeters: null,
      method: "location_match",
    };
  }

  return { isVicinity: false, distanceMeters: null };
}

