import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { extractTextFromPDF } from '@/lib/ocr';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileType = formData.get('type') as string | null; // "image" or "document"

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get file extension and mime type
    const filename = file.name;
    const mimeType = file.type;

    let extractedText: string | undefined;
    let base64Data: string | undefined;

    // Process based on file type
    if (fileType === 'document' && mimeType === 'application/pdf') {
      // Extract text from PDF using OCR
      try {
        extractedText = await extractTextFromPDF(buffer);
      } catch (error) {
        console.error('OCR error:', error);
        extractedText = '[Failed to extract text from document]';
      }
    } else if (fileType === 'image') {
      // For images, also create base64 for Gemini
      base64Data = buffer.toString('base64');
    }

    // Upload to Cloudinary
    const resourceType = fileType === 'image' ? 'image' : 'raw';
    const uploadResult = await uploadToCloudinary(buffer, {
      folder: `chapal-chat/${session.user.id}`,
      resourceType,
      filename,
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      name: filename,
      type: fileType,
      mimeType,
      base64: base64Data,
      extractedText,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 },
    );
  }
}
