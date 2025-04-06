
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
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

// Configure storage for uploaded files
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Image Upload Route
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ 
    message: 'File uploaded successfully',
    fileUrl 
  });
});

// Default route
// app.use(express.static(path.join(__dirname, '/frontend/dist')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '/frontend/dist/index.html'))
// });

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
