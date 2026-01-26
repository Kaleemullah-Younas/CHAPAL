import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  resourceType: string;
}

export async function uploadToCloudinary(
  file: Buffer,
  options: {
    folder?: string;
    resourceType?: 'image' | 'raw' | 'auto';
    filename?: string;
  } = {},
): Promise<UploadResult> {
  const { folder = 'chapal-chat', resourceType = 'auto', filename } = options;

  // For raw files (like PDFs), we need to include the extension in the public_id
  // since Cloudinary doesn't automatically add it for raw resources
  let publicId: string | undefined;
  if (filename) {
    if (resourceType === 'raw') {
      // Keep the full filename with extension for raw files
      publicId = filename;
    } else {
      // For images, strip the extension as Cloudinary handles it
      publicId = filename.split('.')[0];
    }
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
          });
        }
      },
    );

    uploadStream.end(file);
  });
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' = 'image',
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export { cloudinary };
