const SAMPLE_CAR = "ABC Auto Policy. Named insured: Sam Lee. Vehicle: 2019 Honda Civic. Ontario. Liability limit $1,000,000. Collision deductible $500. Comprehensive deductible $500. Using the car for a delivery business is excluded. Renewal date: March 1, 2027.";
const SAMPLE_HOME = "ABC Home Policy. Named insured: Sam Lee. Dwelling in Toronto, Ontario. Building limit $600,000. Deductible $1,000. Personal liability limit $1,000,000. Covers fire and theft. Water backup is excluded unless an endorsement is listed. Flood is not included. Renewal date: March 1, 2027.";

export function emptyPolicy() {
  const id = globalThis.crypto?.randomUUID?.() || `policy-${Date.now()}-${Math.random()}`;
  return { id, label: "", text: "", pages: [], fileName: "", problem: "", pageCount: 0, tab: "paste" };
}

/** Local preview only. Production builds leave this empty. */
export function devCompareSample() {
  if (!import.meta.env.DEV) return null;
  try {
    if (new URLSearchParams(window.location.search).get("sample") !== "compare") return null;
  } catch {
    return null;
  }
  return {
    country: "Canada",
    region: "Ontario",
    policies: [
      { id: "sample-car", label: "Car", tab: "paste", fileName: "", text: SAMPLE_CAR },
      { id: "sample-home", label: "Home", tab: "paste", fileName: "", text: SAMPLE_HOME },
    ],
  };
}
