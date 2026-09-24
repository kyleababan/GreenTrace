export const WASTE_CATEGORIES = {
  Plastic: {
    color: "#0284C7", // Sky Blue
    subcategories: [
      "Plastic bottle",
      "Plastic bag",
      "Plastic food container",
      "Plastic wrapper/packaging",
      "Plastic cup",
      "Other plastic",
    ],
  },
  Paper: {
    color: "#D97706", // Amber
    subcategories: [
      "Cardboard",
      "Paper",
      "Newspaper/magazine",
      "Paper packaging",
      "Other paper",
    ],
  },
  Glass: {
    color: "#0D9488", // Teal
    subcategories: [
      "Glass bottle",
      "Glass container",
      "Broken glass",
      "Other glass",
    ],
  },
  Metal: {
    color: "#475569", // Slate
    subcategories: [
      "Aluminum can",
      "Tin/metal can",
      "Scrap metal",
      "Other metal",
    ],
  },
  "Organic/Biodegradable": {
    color: "#16A34A", // Forest Green
    subcategories: [
      "Food waste",
      "Leaves/grass",
      "Branches/wood",
      "Other organic waste",
    ],
  },
  "E-Waste": {
    color: "#7C3AED", // Purple
    subcategories: [
      "Electronics",
      "Cables/wires",
      "Batteries",
      "Computer/phone parts",
      "Other e-waste",
    ],
  },
  "Construction Waste": {
    color: "#92400E", // Brown
    subcategories: [
      "Concrete",
      "Bricks/tiles",
      "Wood construction material",
      "Other construction waste",
    ],
  },
  "Mixed Waste": {
    color: "#E11D48", // Rose / Red-orange
    subcategories: [],
  },
  "Other/Unknown": {
    color: "#64748B", // Gray
    subcategories: [],
  },
};

export const getWasteCategoryColor = (category) => {
  return WASTE_CATEGORIES[category]?.color || "#64748B";
};

export const formatWasteLabel = (wasteClassification) => {
  if (!wasteClassification || !wasteClassification.category) return null;
  const { category, subcategory } = wasteClassification;
  if (
    category === "Mixed Waste" ||
    category === "Other/Unknown" ||
    !subcategory
  ) {
    return category;
  }
  return `${category} • ${subcategory}`;
};
