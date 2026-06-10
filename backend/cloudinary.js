const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure upload directory
const dbDir = process.env.VERCEL ? '/tmp' : (process.env.DATABASE_DIR || __dirname);
const uploadsDir = path.join(dbDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Check if credentials are present
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary successfully configured.');
} else {
  console.warn('⚠️ Cloudinary environment variables are missing! Falling back to local disk storage in the persistent uploads folder.');
}

const PRESET_TRANSFORMATIONS = {
  '35mm-natural': 'co_rgb:00ffaa,e_colorize:3,e_contrast:-10,e_saturation:15,e_brightness:5,e_noise:8',
  '35mm-flash': 'e_brightness:15,e_contrast:35,e_vignette:45,e_noise:20,e_sharpen:50',
  'pristine-digital': 'e_sharpen:90,e_contrast:12,e_brightness:2',
  'cinematic-portrait': 'e_sharpen:75,e_contrast:10,e_brightness:5,e_vignette:15'
};

/**
 * Applies dynamic transformation parameters to a Cloudinary URL
 */
const getTransformedUrl = (url, preset, isThumbnail = false) => {
  if (!url.includes('res.cloudinary.com')) return url; // Fallback or non-cloudinary URL

  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  let transformations = [];
  
  // Apply aesthetic preset if exists
  if (preset && PRESET_TRANSFORMATIONS[preset]) {
    transformations.push(PRESET_TRANSFORMATIONS[preset]);
  }

  // Apply responsive size/crop
  if (isThumbnail) {
    // 400x400 squared thumbnail with smart cropping
    transformations.push('w_400,h_400,c_fill,g_auto,q_auto,f_auto');
  } else {
    // Optimized preview size
    transformations.push('w_1200,c_limit,q_auto,f_auto');
  }

  return `${parts[0]}/upload/${transformations.join('/')}/${parts[1]}`;
};

/**
 * Orchestrates upload: either pipes to Cloudinary or writes to local public folder
 */
const uploadFile = async (file, preset) => {
  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nfc_event_albums',
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            // Generate transformed URLs
            const imageUrl = getTransformedUrl(result.secure_url, preset, false);
            const thumbnailUrl = getTransformedUrl(result.secure_url, preset, true);
            resolve({
              imageUrl,
              thumbnailUrl,
              publicId: result.public_id
            });
          }
        }
      );
      uploadStream.end(file.buffer);
    });
  } else {
    // Local Fallback Flow
    const filename = `${uuidv4()}-${file.originalname.replace(/\s+/g, '_')}`;
    const targetPath = path.join(uploadsDir, filename);
    
    // Write buffer to disk
    await fs.promises.writeFile(targetPath, file.buffer);
    
    // In local fallback, we serve via static route /uploads/:filename
    const baseUrl = `/uploads/${filename}`;
    
    // We simulate the aesthetics in CSS/Canvas on the frontend, so URLs remain simple
    return {
      imageUrl: baseUrl,
      thumbnailUrl: baseUrl, // frontend will crop it via CSS object-cover
      publicId: filename
    };
  }
};

/**
 * Deletes asset
 */
const deleteFile = async (publicId) => {
  if (isCloudinaryConfigured) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log(`Deleted Cloudinary asset: ${publicId}`);
    } catch (err) {
      console.error('Error deleting Cloudinary asset:', err);
    }
  } else {
    try {
      const filePath = path.join(uploadsDir, publicId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted local file: ${publicId}`);
      }
    } catch (err) {
      console.error('Error deleting local file:', err);
    }
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getTransformedUrl,
  isCloudinaryConfigured
};
