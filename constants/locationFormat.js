export const normalizePurok = (value = "") => {
  const normalized = String(value)
    .trim()
    .replace(/^purok\s*/i, "");
  return normalized ? normalized.replace(/^pk\.\s*/i, "") : "";
};

export const formatLocationWithPurok = (locationName = "", purok = "") => {
  if (!locationName) return "";

  const rawParts = String(locationName)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length === 0) return "";

  // Filter out redundant "Pk. 1" / "Pk. <something>" if locationName already has
  // both a barangay and a street/purok (e.g. ["Mangoto", "Tambis", "Pk. 1"])
  const cleanParts = [];
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    const isPurokPart = /^(?:purok|pk\.?)\s+/i.test(part);
    if (isPurokPart && cleanParts.length >= 2) {
      continue;
    }
    cleanParts.push(part);
  }

  const baseParts = cleanParts.filter(
    (part) => !/^(?:purok|pk\.?)\s+/i.test(part),
  );
  const purokPart = cleanParts.find((part) =>
    /^(?:purok|pk\.?)\s+/i.test(part),
  );

  // If we already have 2 or more base parts (e.g. "Mangoto, Tambis" or "Mangoto, Pinya"),
  // the street/purok is already included in locationName, so return as is without appending Pk.
  if (baseParts.length >= 2) {
    return baseParts.join(", ");
  }

  // If cleanParts already includes an explicit purok part (e.g. "Mangoto, Pk. 2"):
  if (purokPart) {
    return [...baseParts, purokPart].join(", ");
  }

  // If only 1 part exists (e.g. "Mangoto"), append normalized purok if provided and not redundant
  const normalizedPurok = normalizePurok(purok);
  if (!normalizedPurok) {
    return baseParts.join(", ");
  }

  if (
    baseParts.some(
      (part) => part.toLowerCase() === normalizedPurok.toLowerCase(),
    )
  ) {
    return baseParts.join(", ");
  }

  return [...baseParts, `Pk. ${normalizedPurok}`].join(", ");
};
