
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with proper environment variables
cloudinary.config({
  cloud_name: 'dqniuczkg',
  api_key: process.env.CLOUDINARY_API_KEY || '484598966438745',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'lNJ-Csc7X5y0T-2LF1pIlkgr1LA',
  secure: true
});

// Enhanced helper function to standardize upload options
const getUploadOptions = (customOptions = {}) => {
  return {
    folder: 'dhanyabuilders',
    transformation: [
      { quality: 'auto' },
      { fetch_format: 'auto' },
      { flags: 'ml_default' },
      { dpr: 'auto' }
    ],
    resource_type: 'auto',
    ...customOptions
  };
};

module.exports = {
  cloudinary,
  getUploadOptions
};
