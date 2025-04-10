
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const { cloudinary, getUploadOptions } = require('./config/cloudinary');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const materialRoutes = require('./routes/materials');
const attendanceRoutes = require('./routes/attendance');
const transactionRoutes = require('./routes/transactions');
const workerRoutes = require('./routes/workers');
const taskRoutes = require('./routes/tasks');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: '*', // Allow all origins
  credentials: false, // Important: must be false when using '*' origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure temporary memory storage for uploads directly to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harikrishnan9a:1234@dhanyabuildersbackend.nz0as.mongodb.net/?retryWrites=true&w=majority&appName=dhanyabuildersBackend';
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Create default admin user if no users exist
    const User = require('./models/User');
    User.countDocuments()
      .then(count => {
        if (count === 0) {
          console.log('No users found, creating default admin user...');
          const defaultAdmin = new User({
            username: 'admin',
            password: '123456',
            name: 'Admin User',
            role: 'admin',
            email: 'admin@dhanyabuilders.com',
            phone: '9876543210'
          });
          
          defaultAdmin.save()
            .then(() => console.log('Default admin user created successfully'))
            .catch(err => console.error('Error creating default admin user:', err));
        }
      })
      .catch(err => console.error('Error checking for users:', err));
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Set default JWT secret if not provided
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dhanyaBuildersSecretKey';
  console.log('JWT_SECRET not found in environment, using default secret');
}

// Routes
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/tasks', taskRoutes);

// Enhanced image upload route using Cloudinary with better error handling
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  try {
    // Convert buffer to base64 string for Cloudinary upload
    const base64String = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Enhanced upload configuration
    const uploadOptions = getUploadOptions({
      folder: 'dhanyabuilders/uploads',
      public_id: `img_${Date.now()}`
    });
    
    // Upload file to Cloudinary with enhanced options
    const result = await cloudinary.uploader.upload(base64String, uploadOptions);
    
    // Return the Cloudinary URL with additional metadata
    res.json({ 
      message: 'File uploaded successfully to Cloudinary',
      fileUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      version: result.version
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ 
      message: 'Error uploading to Cloudinary', 
      error: error.message,
      details: error.http_code ? `HTTP Code: ${error.http_code}` : 'Unknown error' 
    });
  }
});

// Enhanced base64 image upload route for direct string uploads
app.post('/api/upload/base64', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    // Enhanced upload configuration for base64
    const uploadOptions = getUploadOptions({
      folder: 'dhanyabuilders/base64',
      public_id: `base64_${Date.now()}`
    });
    
    // Upload base64 image to Cloudinary with enhanced options
    const result = await cloudinary.uploader.upload(image, uploadOptions);
    
    res.json({ 
      message: 'Base64 image uploaded successfully',
      fileUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format
    });
  } catch (error) {
    console.error('Cloudinary base64 upload error:', error);
    res.status(500).json({ 
      message: 'Error uploading to Cloudinary', 
      error: error.message,
      details: error.http_code ? `HTTP Code: ${error.http_code}` : 'Unknown error'
    });
  }
});

// Default route
app.get('/', (req, res) => {
  res.send('Welcome to the Dhanya Builders API');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : null 
  });
});

// Start server
const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API accessible at http://localhost:${PORT}/api`);
  console.log(`CORS configured to allow all origins`);
});
