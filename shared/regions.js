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

/** Sent as the country when the person is outside Canada and the United States. */
export const GENERAL_COUNTRY = "General";

/**
 * ISO country and territory codes for the General picker.
 * Canada and the United States are not in this list. They keep their own modes.
 * The code is only used to look up a name. Nothing else depends on which code it is.
 */
const GENERAL_COUNTRY_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
`.trim().split(/\s+/);

export function isGeneralCountry(country) {
  const value = String(country ?? "").trim();
  return value !== "" && value !== "Canada" && value !== "United States";
}

function displayNames(lang) {
  const locales = lang === "fr" ? ["fr-CA", "fr"] : lang === "es" ? ["es-419", "es"] : ["en"];
  try {
    return new Intl.DisplayNames(locales, { type: "region" });
  } catch {
    return new Intl.DisplayNames(["en"], { type: "region" });
  }
}

/**
 * Country names for General mode. The value stays the English name, so the
 * explanation does not change when the page language changes. French and
 * Spanish change only the label. No country in this list has its own rules.
 */
export function generalCountryOptions(lang) {
  const code = lang === "fr" || lang === "es" ? lang : "en";
  const local = displayNames(code);
  const english = displayNames("en");
  const seen = new Set();
  const options = [];
  for (const iso of GENERAL_COUNTRY_CODES) {
    const value = english.of(iso);
    const label = local.of(iso);
    if (!value || !label || value === iso || label === iso) continue;
    if (value === "Canada" || value === "United States") continue;
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label });
  }
  options.sort((a, b) => a.label.localeCompare(b.label, code === "en" ? "en" : code === "fr" ? "fr" : "es"));
  return options;
}

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
