// Province, territory, and state lists for the location picker.
// The value sent to the decoder stays the English name. French and Spanish
// change only the label a person sees.

export const CANADIAN_PROVINCES = [
  { value: "Alberta", fr: "Alberta", es: "Alberta" },
  { value: "British Columbia", fr: "Colombie-Britannique", es: "Columbia Británica" },
  { value: "Manitoba", fr: "Manitoba", es: "Manitoba" },
  { value: "New Brunswick", fr: "Nouveau-Brunswick", es: "Nuevo Brunswick" },
  { value: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador", es: "Terranova y Labrador" },
  { value: "Nova Scotia", fr: "Nouvelle-Écosse", es: "Nueva Escocia" },
  { value: "Ontario", fr: "Ontario", es: "Ontario" },
  { value: "Prince Edward Island", fr: "Île-du-Prince-Édouard", es: "Isla del Príncipe Eduardo" },
  { value: "Quebec", fr: "Québec", es: "Quebec" },
  { value: "Saskatchewan", fr: "Saskatchewan", es: "Saskatchewan" },
  { value: "Northwest Territories", fr: "Territoires du Nord-Ouest", es: "Territorios del Noroeste" },
  { value: "Nunavut", fr: "Nunavut", es: "Nunavut" },
  { value: "Yukon", fr: "Yukon", es: "Yukón" },
];

const US_STATE_NAMES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
];

const US_STATE_LABELS = {
  "District of Columbia": { fr: "District de Columbia", es: "Distrito de Columbia" },
};

export const US_STATES = US_STATE_NAMES.map((value) => ({
  value,
  ...(US_STATE_LABELS[value] || {}),
}));

const DC_ALIASES = [
  "dc",
  "d.c.",
  "d.c",
  "washington dc",
  "washington d.c.",
  "washington, d.c.",
  "washington, dc",
];

export function regionOptions(country, lang) {
  const code = lang === "fr" || lang === "es" ? lang : "en";
  const source = country === "Canada" ? CANADIAN_PROVINCES : US_STATES;
  return source.map((item) => ({
    value: item.value,
    label: code === "en" ? item.value : (item[code] || item.value),
  }));
}

export function normalizeRegionQuery(query) {
  return String(query ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function foldRegion(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function regionMatches(option, rawQuery) {
  const q = normalizeRegionQuery(rawQuery);
  if (!q) return true;
  const folded = foldRegion(q);
  if (folded && (foldRegion(option.label).includes(folded) || foldRegion(option.value).includes(folded))) {
    return true;
  }
  if (option.value !== "District of Columbia" || q === "washington") return false;
  return DC_ALIASES.some((alias) => alias === q || alias.startsWith(q) || q.startsWith(alias));
}

export function filterRegionOptions(options, query) {
  const q = normalizeRegionQuery(query);
  if (!q) return options;
  return options.filter((option) => regionMatches(option, q));
}

export function commitRegion(options, rawQuery) {
  const q = normalizeRegionQuery(rawQuery);
  if (!q) return "";
  const folded = foldRegion(q);
  const exact = options.find((option) => (
    foldRegion(option.label) === folded || foldRegion(option.value) === folded
  ));
  if (exact) return exact.value;
  if (options.some((option) => option.value === "District of Columbia") && DC_ALIASES.includes(q)) {
    return "District of Columbia";
  }
  return "";
}
