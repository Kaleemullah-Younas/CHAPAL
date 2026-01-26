// OCR utilities for extracting text from PDF documents
// This runs on the server side using pdfjs-dist and tesseract.js

import Tesseract from 'tesseract.js';

interface TextItem {
  str: string;
}

function hasStr(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item;
}

/**
 * Extract text from a PDF buffer using OCR
 * Uses pdfjs-dist to render PDF pages to images, then tesseract for OCR
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues with pdfjs-dist in different environments
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const textParts: string[] = [];

  // Process each page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);

    // First try to extract text directly (for text-based PDFs)
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => (hasStr(item) ? item.str : ''))
      .join(' ')
      .trim();

    if (pageText.length > 50) {
      // If we got substantial text, use it directly
      textParts.push(`--- Page ${pageNum} ---\n${pageText}`);
    } else {
      // Otherwise, render to image and use OCR
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

      // Create a canvas-like structure for node
      const { createCanvas } = await import('canvas');
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({
        canvasContext: context as any,
        viewport,
      } as any).promise;

      // Convert canvas to buffer
      const imageBuffer = canvas.toBuffer('image/png');

      // Run OCR on the image
      const {
        data: { text },
      } = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: () => {}, // Suppress logs
      });

      textParts.push(`--- Page ${pageNum} ---\n${text.trim()}`);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Extract text from an image using OCR
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
): Promise<string> {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, 'eng', {
    logger: () => {}, // Suppress logs
  });

  return text.trim();
}
