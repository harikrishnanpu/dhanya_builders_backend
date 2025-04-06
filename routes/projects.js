
const express = require('express');
const Project = require('../models/Project');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Create a new project (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, location, description, startDate, endDate, supervisorId, status, estimatedAmount } = req.body;
    
    if (!name || !location || !startDate || !supervisorId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const project = new Project({
      name,
      location,
      description,
      startDate,
      endDate,
      supervisorId,
      status: status || 'planning',
      estimatedAmount: estimatedAmount || 0
    });
    
    await project.save();
    
    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: project._id,
        name: project.name,
        location: project.location,
        description: project.description,
        startDate: project.startDate,
        endDate: project.endDate,
        supervisorId: project.supervisorId,
        status: project.status,
        estimatedAmount: project.estimatedAmount,
        createdAt: project.createdAt
      }
    });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all projects (filtered for supervisors)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    // If user is a supervisor, only show their projects
    if (req.user.role === 'supervisor') {
      query.supervisorId = req.user._id;
    }
    
    const projects = await Project.find(query)
      .populate('supervisorId', 'name username')
      .sort({ createdAt: -1 });
    
    const formattedProjects = projects.map(project => ({
      id: project._id,
      name: project.name,
      location: project.location,
      description: project.description,
      startDate: project.startDate,
      endDate: project.endDate,
      supervisorId: project.supervisorId?._id || project.supervisorId,
      supervisor: project.supervisorId ? {
        id: project.supervisorId._id,
        name: project.supervisorId.name,
        username: project.supervisorId.username
      } : null,
      status: project.status,
      estimatedAmount: project.estimatedAmount,
      createdAt: project.createdAt
    }));
    
    res.json(formattedProjects);
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific project
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('supervisorId', 'name username');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to view this project
    if (req.user.role === 'supervisor') {
      // Compare the ObjectId as strings
      const projectSupervisorId = project.supervisorId?._id?.toString() || project.supervisorId?.toString();
      const userIdString = req.user._id.toString();
      
      if (projectSupervisorId !== userIdString) {
        return res.status(403).json({ message: 'Not authorized to view this project' });
      }
    }
    
    res.json({
      id: project._id,
      name: project.name,
      location: project.location,
      description: project.description,
      startDate: project.startDate,
      endDate: project.endDate,
      supervisorId: project.supervisorId?._id || project.supervisorId,
      supervisor: project.supervisorId ? {
        id: project.supervisorId._id,
        name: project.supervisorId.name,
        username: project.supervisorId.username
      } : null,
      status: project.status,
      estimatedAmount: project.estimatedAmount,
      createdAt: project.createdAt,
      tasks: project.tasks,
      images: project.images
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a project (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, location, description, startDate, endDate, supervisorId, status, estimatedAmount } = req.body;
    
    if (!name || !location || !startDate || !supervisorId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        name,
        location,
        description,
        startDate,
        endDate,
        supervisorId,
        status,
        estimatedAmount
      },
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({
      message: 'Project updated successfully',
      project: {
        id: project._id,
        name: project.name,
        location: project.location,
        description: project.description,
        startDate: project.startDate,
        endDate: project.endDate,
        supervisorId: project.supervisorId,
        status: project.status,
        estimatedAmount: project.estimatedAmount,
        createdAt: project.createdAt
      }
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update project status (admin or assigned supervisor)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate the status value
    if (!['planning', 'ongoing', 'completed', 'onHold'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    // Find the project
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to update this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }
    
    // Update the status
    project.status = status;
    await project.save();
    
    res.json({
      message: 'Project status updated successfully',
      project: {
        id: project._id,
        name: project.name,
        location: project.location,
        description: project.description,
        startDate: project.startDate,
        endDate: project.endDate,
        supervisorId: project.supervisorId,
        status: project.status,
        estimatedAmount: project.estimatedAmount,
        createdAt: project.createdAt
      }
    });
  } catch (error) {
    console.error('Update project status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a project (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
