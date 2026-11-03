/** Photos and scanned pages sent to the model. The bytes are not stored. */

export const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Pages of one document we will read as photos. */
export const MAX_IMAGE_PAGES = 16;

/**
 * Longest edge, in pixels, before a photo is sent.
 * A phone photo of a page is still readable at this size, and the
 * vision call finishes inside the function time limit.
 */
export const MAX_IMAGE_EDGE = 1024;

/**
 * Base64 length cap for one photo. About 350 KB of image data.
 * One page then stays far under Netlify's 6 MB request limit, and the
 * vision call has less to look at.
 */
export const MAX_IMAGE_DATA_CHARS = 480_000;

/**
 * A text PDF has sentences. A scan, or a PDF made from phone photos,
 * usually has no text layer, or only a few stray characters.
 */
export function textIsEnough(text, pageCount = 1) {
  const trimmed = String(text ?? "").replace(/\s+/g, " ").trim();
  const pages = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 1;
  return trimmed.length >= Math.max(40, pages * 40);
}

export function fittedSize(width, height, maxEdge = MAX_IMAGE_EDGE) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { width: Math.round(w), height: Math.round(h) };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** Canvas JPEGs start with this. Anything else is not a JPEG we made. */
export function isJpegData(data) {
  return String(data || "").startsWith("/9j/");
}

export function cleanImage(value) {
  if (!value || typeof value !== "object") return null;
  let mediaType = String(value.mediaType || "").toLowerCase();
  let data = String(value.data || "").trim();
  const dataUrl = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(data);
  if (dataUrl) {
    if (!mediaType) mediaType = dataUrl[1].toLowerCase();
    data = dataUrl[2];
  }
  data = data.replace(/\s/g, "");
  if (!IMAGE_MEDIA_TYPES.includes(mediaType)) return null;
  if (data.length < 32 || data.length > MAX_IMAGE_DATA_CHARS) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  return { mediaType, data };
}

export function policyHasReading(policy) {
  if (String(policy?.text || "").trim()) return true;
  return Array.isArray(policy?.pages) && policy.pages.some((page) => cleanImage(page));
}

export function photoInstruction(index, count) {
  const place = count > 1
    ? `This is page ${index} of ${count}, in order.`
    : "This is the only page.";
  return [
    "The attached image is a photo or scan of one page of an insurance document.",
    "Read only what is visible. If a word is unclear, leave it out rather than guessing. Do not invent coverage.",
    place,
  ].join(" ");
}
