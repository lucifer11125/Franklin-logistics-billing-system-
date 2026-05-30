import * as pdfjsLib from 'pdfjs-dist';

// Bundle the PDF.js worker locally using Vite for absolute offline-first stability
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Extract text from all pages of a digital PDF file using PDF.js.
 * Preserves horizontal and vertical reading layouts by sorting text segments.
 * @param file - PDF File object
 * @returns Verbatim layout-accurate text string
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    if (!items || items.length === 0) continue;

    // Group text items by y-coordinate (transform[5]) for layout-preserving ordering
    const rows: { [key: number]: any[] } = {};
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      // Group by y coordinate with a 1px tolerance to capture slightly misaligned inline items
      const y = Math.round(item.transform[5]);
      if (!rows[y]) rows[y] = [];
      rows[y].push(item);
    }

    // Sort rows from top to bottom (Y coordinate is highest at top in PDF space)
    const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);

    let pageText = '';
    for (const y of sortedY) {
      // Sort items in the row from left to right (X coordinate: transform[4])
      const rowItems = rows[y].sort((a, b) => a.transform[4] - b.transform[4]);
      const rowStr = rowItems.map(item => item.str).join(' ');
      pageText += rowStr + '\n';
    }

    fullText += pageText + '\n';
  }

  return fullText;
}

export default extractTextFromPdf;
