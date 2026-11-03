import {
  MAX_IMAGE_PAGES,
  fittedSize,
  textIsEnough,
} from "../shared/images.js";

export const FILE_ACCEPT = ".txt,.pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,image/*,application/pdf";

function fileNameOf(file) {
  return String(file?.name || "").trim();
}

function lowerName(file) {
  return fileNameOf(file).toLowerCase();
}

export function isPdfFile(file) {
  return file?.type === "application/pdf" || lowerName(file).endsWith(".pdf");
}

export function isHeicFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = lowerName(file);
  return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

export function isImageFile(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|heic|heif)$/.test(lowerName(file));
}

export function isTextFile(file) {
  const type = String(file?.type || "").toLowerCase();
  return type.startsWith("text/") || lowerName(file).endsWith(".txt");
}

async function defaultReadPdf(file) {
  const pdfjs = globalThis.window?.pdfjsLib;
  if (!pdfjs?.getDocument) {
    const error = new Error("pdf");
    error.code = "pdf";
    throw error;
  }
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return { text, pageCount: pdf.numPages, pdf };
}

async function defaultRenderPdf(loaded) {
  const pdf = loaded?.pdf;
  if (!pdf?.getPage) return [];
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const size = fittedSize(base.width, base.height);
    const scale = base.width > 0 ? size.width / base.width : 1;
    const viewport = page.getViewport({ scale: scale || 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    const encoded = await defaultEncodeCanvas(canvas);
    if (encoded) pages.push(encoded);
  }
  return pages;
}

async function defaultConvertHeic(file) {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.82 });
  return Array.isArray(result) ? result : [result];
}

function blobToImage(blob) {
  return createImageBitmap(blob);
}

async function defaultEncodeCanvas(canvas) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  const data = String(dataUrl).split(",")[1] || "";
  if (!data) return null;
  return { mediaType: "image/jpeg", data };
}

export async function defaultEncodeImage(file) {
  const bitmap = await blobToImage(file);
  try {
    const size = fittedSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return defaultEncodeCanvas(canvas);
  } finally {
    bitmap.close?.();
  }
}

async function readOne(file, deps) {
  const name = fileNameOf(file);
  try {
    if (isTextFile(file)) {
      const text = typeof file.text === "function" ? await file.text() : "";
      return { text: String(text || ""), pages: [] };
    }
    if (isPdfFile(file)) {
      const loaded = await deps.readPdf(file);
      const pageCount = loaded?.pageCount || 1;
      if (textIsEnough(loaded?.text, pageCount)) return { text: loaded.text, pages: [] };
      const pages = await deps.renderPdf(loaded);
      if (!pages?.length) return { errorKey: "noText", fileName: name };
      return { text: "", pages };
    }
    if (isHeicFile(file)) {
      const blobs = await deps.convertHeic(file);
      const pages = [];
      for (const blob of blobs) {
        const page = await deps.encodeImage(blob);
        if (page) pages.push(page);
      }
      if (!pages.length) return { errorKey: "photo", fileName: name };
      return { text: "", pages };
    }
    if (isImageFile(file)) {
      const page = await deps.encodeImage(file);
      if (!page) return { errorKey: "photo", fileName: name };
      return { text: "", pages: [page] };
    }
  } catch (err) {
    const code = err?.code === "pdf" ? "pdf" : (isPdfFile(file) ? "pdf" : "photo");
    return { errorKey: code, fileName: name };
  }
  return { errorKey: "noText", fileName: name };
}

function labelFor(names) {
  const clean = names.map((name) => String(name || "").trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return clean.join(", ");
}

/**
 * Read one or more files as one document.
 * A text PDF stays text. A scanned PDF or a photo becomes page images.
 * Nothing is uploaded here; the caller sends a page only when asking for an explanation.
 */
export async function readDocumentFiles(fileList, deps = {}) {
  const files = Array.from(fileList || []).filter(Boolean);
  const names = files.map(fileNameOf);
  const fileName = labelFor(names);
  if (!files.length) return { text: "", pages: [], fileName: "", errorKey: "noText" };

  const readPdf = deps.readPdf || defaultReadPdf;
  const renderPdf = deps.renderPdf || defaultRenderPdf;
  const convertHeic = deps.convertHeic || defaultConvertHeic;
  const encodeImage = deps.encodeImage || defaultEncodeImage;

  let text = "";
  const pages = [];
  for (const file of files) {
    const part = await readOne(file, { readPdf, renderPdf, convertHeic, encodeImage });
    if (part.errorKey) {
      return {
        text: "",
        pages: [],
        fileName: part.fileName || fileName,
        errorKey: part.errorKey,
        pageCount: part.pageCount || 0,
      };
    }
    if (part.text) text += `${text ? "\n\n" : ""}${part.text}`;
    if (part.pages?.length) pages.push(...part.pages);
  }

  if (pages.length > MAX_IMAGE_PAGES) {
    return { text: "", pages: [], fileName, errorKey: "tooMany", pageCount: pages.length };
  }
  if (pages.length) return { text: "", pages, fileName, errorKey: "" };
  if (textIsEnough(text, files.length)) return { text, pages: [], fileName, errorKey: "" };
  return { text: "", pages: [], fileName, errorKey: "noText" };
}

/** One file, for callers that still pass a single File. */
export async function readDocumentFile(file, deps) {
  return readDocumentFiles(file ? [file] : [], deps);
}
