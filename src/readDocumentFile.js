/** Read a text or PDF file in the browser. The file is not uploaded. */
export async function readDocumentFile(file) {
  if (!file) return { text: "" };
  const name = String(file.name || "");
  const isPdf = file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    const text = typeof file.text === "function" ? await file.text() : "";
    return { text: String(text || ""), fileName: name };
  }
  if (!window.pdfjsLib?.getDocument) return { errorKey: "pdfReadError", fileName: name };
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map((item) => item.str).join(" ") + "\n";
    }
    if (!fullText.trim()) return { errorKey: "pdfScanned", fileName: name };
    return { text: fullText, fileName: name };
  } catch {
    return { errorKey: "pdfReadError", fileName: name };
  }
}
