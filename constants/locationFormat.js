export const PINAMUNGAJAN_BARANGAYS = [
  "Anislag",
  "Anopog",
  "Binabag",
  "Buhingtubig",
  "Busay",
  "Butong",
  "Cabiangon",
  "Camugao",
  "Duangan",
  "Guimbawian",
  "Lamac",
  "Lut-od",
  "Mangoto",
  "Opao",
  "Poblacion",
  "Punod",
  "Rizal",
  "Sacsac",
  "Sambagon",
  "Sibago",
  "Tajao",
  "Tangub",
  "Tanibag",
  "Tupas",
  "Tutay",
];

export const BARANGAY_COORDINATES = {
  anislag: { lat: 10.285, lng: 123.57 },
  anopog: { lat: 10.292, lng: 123.615 },
  binabag: { lat: 10.26, lng: 123.575 },
  buhingtubig: { lat: 10.252, lng: 123.602 },
  busay: { lat: 10.28, lng: 123.63 },
  butong: { lat: 10.245, lng: 123.58 },
  cabiangon: { lat: 10.275, lng: 123.61 },
  camugao: { lat: 10.295, lng: 123.59 },
  duangan: { lat: 10.24, lng: 123.62 },
  guimbawian: { lat: 10.265, lng: 123.635 },
  lamac: { lat: 10.3, lng: 123.64 },
  lutod: { lat: 10.31, lng: 123.61 },
  "lut-od": { lat: 10.31, lng: 123.61 },
  mangoto: { lat: 10.285, lng: 123.56 },
  opao: { lat: 10.27, lng: 123.57 },
  poblacion: { lat: 10.2705, lng: 123.5855 },
  punod: { lat: 10.29, lng: 123.575 },
  rizal: { lat: 10.26, lng: 123.62 },
  sacsac: { lat: 10.255, lng: 123.63 },
  sambagon: { lat: 10.282, lng: 123.6 },
  sibago: { lat: 10.298, lng: 123.58 },
  tajao: { lat: 10.305, lng: 123.565 },
  tangub: { lat: 10.25, lng: 123.565 },
  tanibag: { lat: 10.275, lng: 123.565 },
  tupas: { lat: 10.265, lng: 123.56 },
  tutay: { lat: 10.278, lng: 123.588 },
};

/**
 * Calculates the nearest Pinamungajan barangay using GPS coordinates.
 * Excellent fallback when OpenStreetMap cannot detect rural/sub-barangay boundaries.
 */
export const findNearestBarangay = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Poblacion";

  let minDistance = Infinity;
  let nearestKey = "poblacion";

  for (const [key, coords] of Object.entries(BARANGAY_COORDINATES)) {
    if (key === "lutod") continue;
    const dLat = coords.lat - lat;
    const dLng = coords.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      nearestKey = key;
    }
  }

  const matched = PINAMUNGAJAN_BARANGAYS.find(
    (b) =>
      b.toLowerCase().replace(/[^a-z]/g, "") ===
      nearestKey.replace(/[^a-z]/g, ""),
  );
  return matched || "Poblacion";
};

export const MUNICIPALITY_OR_PROVINCE_NAMES = new Set([
  "pinamungajan",
  "cebu",
  "cebucity",
  "philippines",
  "regionvii",
  "centralvisayas",
]);

export const normalizePurok = (value = "") => {
  const trimmed = String(value || "").trim();
  const norm = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (MUNICIPALITY_OR_PROVINCE_NAMES.has(norm)) {
    return "";
  }
  const normalized = trimmed.replace(/^purok\s*/i, "");
  return normalized ? normalized.replace(/^pk\.\s*/i, "") : "";
};

/**
 * Formats a purok or sitio string:
 * - If it's a number (e.g. "3" or "Pk. 3"), formats as "Purok 3"
 * - If it starts with "sitio", capitalizes as "Sitio ..."
 * - If it starts with "purok", capitalizes as "Purok ..."
 * - Ignores municipality names like "Pinamungajan"
 * - Otherwise preserves the name (e.g. "Sitio Bato")
 */
export const formatPurokOrSitio = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const norm = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (MUNICIPALITY_OR_PROVINCE_NAMES.has(norm)) {
    return "";
  }

  // Check if it's "Pk. 3" or "Pk 3"
  const pkMatch = trimmed.match(/^pk\.?\s*(.*)$/i);
  if (pkMatch) {
    const rest = pkMatch[1].trim();
    return rest ? `Purok ${rest}` : "Purok";
  }

  // Check if it starts with "sitio"
  const sitioMatch = trimmed.match(/^sitio\s*(.*)$/i);
  if (sitioMatch) {
    const rest = sitioMatch[1].trim();
    return rest ? `Sitio ${rest}` : "Sitio";
  }

  // Check if it starts with "purok"
  const purokMatch = trimmed.match(/^purok\s*(.*)$/i);
  if (purokMatch) {
    const rest = purokMatch[1].trim();
    return rest ? `Purok ${rest}` : "Purok";
  }

  // If it's just a number
  if (/^\d+$/.test(trimmed)) {
    return `Purok ${trimmed}`;
  }

  return trimmed;
};

const STREET_INDICATORS =
  /\b(?:st\.?|street|ave\.?|avenue|rd\.?|road|blvd\.?|boulevard|hwy|highway|lane|way|alley|drive|dr\.?)\b/i;

/**
 * Helper to match a string against Pinamungajan barangays.
 */
export const findMatchingBarangay = (str = "") => {
  if (!str) return "";
  const trimmed = str.trim();

  // If it explicitly contains street words like "St.", "Street", "Road", etc., it is a street name, not a barangay
  if (STREET_INDICATORS.test(trimmed)) {
    return "";
  }

  // Strip common prefixes: "barangay", "brgy.", "brgy", "bgy.", "bgy"
  const withoutPrefix = trimmed
    .toLowerCase()
    .replace(/^(?:barangay|brgy\.?|bgy\.?)\s+/i, "")
    .replace(/\s*,?\s*(?:pinamungajan|cebu|philippines).*$/i, "")
    .trim();

  const cleaned = withoutPrefix.replace(/[^a-z]/g, "");

  // 1. Exact match against cleaned name
  const exact = PINAMUNGAJAN_BARANGAYS.find(
    (b) => b.toLowerCase().replace(/[^a-z]/g, "") === cleaned,
  );
  if (exact) return exact;

  // 2. Distinct word match inside the string
  for (const b of PINAMUNGAJAN_BARANGAYS) {
    const bClean = b.toLowerCase().replace(/[^a-z]/g, "");
    const regex = new RegExp(`\\b${bClean}\\b`, "i");
    if (regex.test(withoutPrefix)) {
      return b;
    }
  }

  return "";
};

/**
 * Splits any location string into structured parts:
 * { street, purokOrSitio, barangay, municipality }
 */
export const splitLocationDetails = (
  locationString = "",
  explicitPurok = "",
  explicitBarangay = "",
  explicitMunicipality = "",
) => {
  // First split by commas
  let rawParts = String(locationString || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let municipality = explicitMunicipality ? explicitMunicipality.trim() : "";

  // Filter out any standalone municipality, province, or country labels so they don't become 'street' or 'purok'
  rawParts = rawParts.filter((part) => {
    const norm = part.toLowerCase().replace(/[^a-z]/g, "");
    if (MUNICIPALITY_OR_PROVINCE_NAMES.has(norm)) {
      if (!municipality && norm === "pinamungajan") {
        municipality = "Pinamungajan";
      }
      return false;
    }
    return true;
  });

  let barangay = explicitBarangay ? explicitBarangay.trim() : "";
  let purokOrSitio = explicitPurok ? explicitPurok.trim() : "";
  let street = "";

  if (purokOrSitio) {
    const norm = purokOrSitio.toLowerCase().replace(/[^a-z]/g, "");
    if (MUNICIPALITY_OR_PROVINCE_NAMES.has(norm)) {
      purokOrSitio = "";
    }
  }

  // 1. Identify barangay from parts if not explicit
  if (!barangay) {
    // First pass: exact match
    for (let i = 0; i < rawParts.length; i++) {
      const match = findMatchingBarangay(rawParts[i]);
      if (
        match &&
        rawParts[i].toLowerCase().replace(/[^a-z]/g, "") ===
          match.toLowerCase().replace(/[^a-z]/g, "")
      ) {
        barangay = match;
        rawParts.splice(i, 1);
        break;
      }
    }
    // Second pass: general match
    if (!barangay) {
      for (let i = 0; i < rawParts.length; i++) {
        const match = findMatchingBarangay(rawParts[i]);
        if (match) {
          barangay = match;
          rawParts.splice(i, 1);
          break;
        }
      }
    }
  } else {
    // Remove barangay if it appears in rawParts
    const bMatch = findMatchingBarangay(barangay) || barangay;
    const bIdx = rawParts.findIndex(
      (p) => findMatchingBarangay(p).toLowerCase() === bMatch.toLowerCase(),
    );
    if (bIdx !== -1) {
      rawParts.splice(bIdx, 1);
    }
  }

  // 2. Identify purok or sitio from remaining parts if not explicit
  if (!purokOrSitio) {
    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i];
      const normPart = part.toLowerCase().replace(/[^a-z]/g, "");
      if (MUNICIPALITY_OR_PROVINCE_NAMES.has(normPart)) {
        continue;
      }
      if (/^(?:purok|pk\.?|sitio)\b/i.test(part) || /^\d+$/.test(part)) {
        purokOrSitio = part;
        rawParts.splice(i, 1);
        break;
      }
    }
  } else {
    // Remove purok/sitio if it appears in rawParts
    const normP = normalizePurok(purokOrSitio).toLowerCase();
    const pIdx = rawParts.findIndex((p) => {
      const np = normalizePurok(p).toLowerCase();
      return (
        (normP && np === normP) ||
        p.toLowerCase() === purokOrSitio.toLowerCase() ||
        /^(?:purok|pk\.?|sitio)\b/i.test(p)
      );
    });
    if (pIdx !== -1) {
      rawParts.splice(pIdx, 1);
    }
  }

  // 3. Any remaining parts are street / landmark / address
  street = rawParts.join(", ");

  return {
    street: street.trim(),
    purokOrSitio: formatPurokOrSitio(purokOrSitio),
    barangay: barangay.trim(),
    municipality: municipality.trim() || "Pinamungajan",
  };
};

/**
 * Universal location formatter that formats as:
 * "Street, Sitio or Purok, Barangay, Municipal or City"
 *
 * Accepts either:
 * - formatLocationWithPurok(postObject)
 * - formatLocationWithPurok(locationName, purok, barangay, municipality)
 */
export const formatLocationWithPurok = (
  locationOrPost,
  explicitPurok = "",
  explicitBarangay = "",
  explicitMunicipality = "",
) => {
  if (!locationOrPost) return "";

  let locationName = "";
  let purok = explicitPurok;
  let barangay = explicitBarangay;
  let street = "";
  let municipality = explicitMunicipality;

  if (typeof locationOrPost === "object" && locationOrPost !== null) {
    locationName =
      locationOrPost.meetingLocation || locationOrPost.locationName || "";
    purok = locationOrPost.purok || explicitPurok;
    barangay = locationOrPost.barangay || explicitBarangay;
    street = locationOrPost.street || "";
    municipality =
      locationOrPost.municipality ||
      locationOrPost.city ||
      locationOrPost.municipal ||
      explicitMunicipality;
  } else {
    locationName = String(locationOrPost);
  }

  const parsed = splitLocationDetails(
    locationName,
    purok,
    barangay,
    municipality,
  );
  const finalStreet = street ? street.trim() : parsed.street;
  const finalPurok = parsed.purokOrSitio;
  const finalBarangay = parsed.barangay;
  const finalMunicipality = (
    municipality ||
    parsed.municipality ||
    "Pinamungajan"
  ).trim();

  // Format: Street, Sitio or Purok, Barangay, Municipal or City
  const orderedParts = [
    finalStreet,
    finalPurok,
    finalBarangay,
    finalMunicipality,
  ].filter(Boolean);

  if (orderedParts.length === 0) {
    return locationName || "";
  }

  return orderedParts.join(", ");
};
