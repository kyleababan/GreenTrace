export const normalizePurok = (value = "") => {
  const normalized = String(value)
    .trim()
    .replace(/^purok\s*/i, "");
  return normalized ? normalized.replace(/^pk\.\s*/i, "") : "";
};

export const formatLocationWithPurok = (locationName = "", purok = "") => {
  const locationParts = String(locationName)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(?:purok|pk\.?)\s+/i.test(part));
  const normalizedPurok = normalizePurok(purok);

  if (!normalizedPurok) return locationParts.join(", ");

  return [...locationParts, `Pk. ${normalizedPurok}`].join(", ");
};
