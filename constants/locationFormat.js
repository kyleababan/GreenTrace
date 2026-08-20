export const normalizePurok = (value = "") =>
  value
    .trim()
    .replace(/^(?:purok|pk\.?)\s*/i, "")
    .trim();

export const formatLocationWithPurok = (locationName, purok) => {
  const parts = (locationName || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const normalizedPurok = normalizePurok(purok);

  if (!normalizedPurok) {
    const formattedParts = parts.map((part) =>
      /^(?:purok|pk\.?)\s*/i.test(part)
        ? `Pk. ${normalizePurok(part)}`
        : part,
    );

    return formattedParts.join(", ") || "Unknown location";
  }

  const filteredParts = parts.filter(
    (part) =>
      normalizePurok(part).toLowerCase() !== normalizedPurok.toLowerCase(),
  );

  return [...filteredParts, `Pk. ${normalizedPurok}`].join(", ");
};
