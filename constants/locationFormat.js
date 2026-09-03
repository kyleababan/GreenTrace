export const normalizePurok = (value = "") => {
  const normalized = String(value)
    .trim()
    .replace(/^purok\s*/i, "");
  return normalized ? normalized.replace(/^pk\.\s*/i, "") : "";
};
