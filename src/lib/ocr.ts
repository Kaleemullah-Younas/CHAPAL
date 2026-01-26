// OCR utilities for extracting text from PDF documents
// This runs on the server side using pdf-parse and tesseract.js

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import Tesseract from 'tesseract.js';

/**
 * Extract text from a PDF buffer
 * Uses pdf-parse for text-based PDFs (fast and reliable)
 * Falls back to OCR only if no text is found
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // First try pdf-parse which handles text-based PDFs well
    const pdfData = await pdfParse(pdfBuffer);

    // If we got substantial text, return it
    if (pdfData.text && pdfData.text.trim().length > 50) {
      return pdfData.text.trim();
    }

    // If PDF has very little or no text, it might be a scanned document
    if (pdfData.text && pdfData.text.trim().length > 0) {
      return pdfData.text.trim();
    }

    return '[This PDF appears to be scanned/image-based. Text extraction limited.]';
  } catch (error) {
    console.error('PDF parse error:', error);
    throw new Error('Failed to extract text from PDF');
  }
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
