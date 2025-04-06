const express = require('express');
const Worker = require('../models/Worker');
const Project = require('../models/Project');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Add a new worker
router.post('/', auth, async (req, res) => {
  try {
    const { name, role, phone, address, dailyWage, joiningDate, projectId } = req.body;
    
    // If project is specified, check if it exists
    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if user is authorized to add worker to this project
      if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to add worker to this project' });
      }
    }
    
    // Create worker
    const worker = new Worker({
      name,
      role,
      phone,
      address,
      dailyWage,
      joiningDate: joiningDate || new Date(),
      projectId
    });
    
    await worker.save();
    
    res.status(201).json({
      message: 'Worker added successfully',
      worker
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all workers
router.get('/', auth, async (req, res) => {
  try {
    const { projectId } = req.query;
    let query = {};
    
    // Filter by project
    if (projectId) {
      query.projectId = projectId;
    }
    
    // For supervisors, only show workers for their projects
    if (req.user.role === 'supervisor') {
      // Get projects assigned to this supervisor
      const projects = await Project.find({ supervisorId: req.user._id }).select('_id');
      const projectIds = projects.map(project => project._id);
      
      if (projectId) {
        // If project filter is applied, check if supervisor has access to it
        if (!projectIds.includes(projectId)) {
          return res.status(403).json({ message: 'Not authorized to view workers for this project' });
        }
      } else {
        // Otherwise, show workers for all projects assigned to supervisor
        query.projectId = { $in: projectIds };
      }
    }
    
    const workers = await Worker.find(query)
      .populate('projectId', 'name location')
      .sort({ name: 1 });
    
    res.json(workers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get workers for a specific project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to view workers for this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view workers for this project' });
    }
    
    const workers = await Worker.find({ projectId })
      .sort({ name: 1 });
    
    res.json(workers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific worker
router.get('/:id', auth, async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id)
      .populate('projectId', 'name location supervisorId');
    
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // Check if user is authorized to view this worker
    if (req.user.role === 'supervisor' && 
        worker.projectId?.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this worker' });
    }
    
    res.json(worker);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a worker
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, role, phone, address, dailyWage, projectId } = req.body;
    
    // Find worker
    const worker = await Worker.findById(req.params.id)
      .populate('projectId');
    
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // Check if user is authorized to update this worker
    if (req.user.role === 'supervisor') {
      if (worker.projectId && worker.projectId.supervisorId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this worker' });
      }
      
      // If changing project, check if supervisor has access to new project
      if (projectId && projectId !== worker.projectId?._id.toString()) {
        const newProject = await Project.findById(projectId);
        if (!newProject || newProject.supervisorId?.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to assign worker to this project' });
        }
      }
    }
    
    // Update fields
    if (name) worker.name = name;
    if (role) worker.role = role;
    if (phone) worker.phone = phone;
    if (address) worker.address = address;
    if (dailyWage !== undefined) worker.dailyWage = dailyWage;
    if (projectId !== undefined) worker.projectId = projectId;
    
    await worker.save();
    
    res.json({
      message: 'Worker updated successfully',
      worker
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a worker
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find worker
    const worker = await Worker.findById(req.params.id)
      .populate('projectId');
    
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // Check if user is authorized to delete this worker
    if (req.user.role === 'supervisor' && 
        worker.projectId && worker.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this worker' });
    }
    
    await Worker.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Worker deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
