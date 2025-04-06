const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Register a new user (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { username, password, name, role, email, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with that username or email' });
    }
    
    // Create new user
    const user = new User({
      username,
      password,
      name,
      role,
      email,
      phone
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('User creation error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Better logging for debugging
    console.log(`Login attempt for username: ${username}`);
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    console.log(`User found: ${username}, role: ${user.role}`);
    
    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log(`Password mismatch for user: ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Make sure JWT_SECRET is available
    const jwtSecret = process.env.JWT_SECRET || 'dhanyaBuildersSecretKey';
    if (!jwtSecret) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      jwtSecret,
      { expiresIn: '7d' }
    );
    
    console.log(`Login successful for user: ${username}, role: ${user.role}`);
    
    // Return data in the expected format directly (not wrapped in a data property)
    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    const formattedUsers = users.map(user => ({
      _id: user._id,
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get supervisors (accessible by admin and supervisors)
router.get('/supervisors', auth, async (req, res) => {
  try {
    const supervisors = await User.find({ role: 'supervisor' }).select('-password');
    
    const formattedSupervisors = supervisors.map(user => ({
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone
    }));
    
    res.json(formattedSupervisors);
  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user (admin can update any user, users can update only themselves)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is authorized to update this user
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }
    
    const { name, email, phone, password } = req.body;
    
    const updateData = { name, email, phone };
    if (password) {
      // If password is being updated, it will be hashed by the pre-save middleware
      updateData.password = password;
    }
    
    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
