
const express = require('express');
const Material = require('../models/Material');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Create a new material request
router.post('/', auth, async (req, res) => {
  try {
    const { projectId, name, quantity, unit, supplier, cost, status, notes } = req.body;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to add materials to this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to add materials to this project' });
    }
    
    // Create the material request
    const material = new Material({
      projectId,
      name,
      quantity,
      unit,
      supplier,
      cost,
      status: status || 'requested',
      requestedBy: req.user._id,
      notes
    });
    
    await material.save();
    
    res.status(201).json({
      message: 'Material request created successfully',
      material
    });
  } catch (error) {
    console.error('Error creating material:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all materials (filtered for admin/supervisor)
router.get('/', auth, async (req, res) => {
  try {
    const { projectId, status } = req.query;
    let query = {};
    
    // Filter by project
    if (projectId) {
      query.projectId = projectId;
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // If user is a supervisor, only show materials for their projects
    if (req.user.role === 'supervisor') {
      // Get projects assigned to this supervisor
      const projects = await Project.find({ supervisorId: req.user._id }).select('_id');
      const projectIds = projects.map(project => project._id);
      
      query.projectId = { $in: projectIds };
    }
    
    const materials = await Material.find(query)
      .populate('projectId', 'name location')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username')
      .sort({ createdAt: -1 });
    
    res.json(materials);
  } catch (error) {
    console.error('Error getting materials:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get materials for a specific project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to view materials for this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view materials for this project' });
    }
    
    const materials = await Material.find({ projectId })
      .populate('projectId', 'name location')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username')
      .sort({ createdAt: -1 });
    
    res.json(materials);
  } catch (error) {
    console.error('Error getting project materials:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve a material request (admin only)
router.patch('/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    const { approvedQuantity, notes } = req.body;
    
    const material = await Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ message: 'Material request not found' });
    }
    
    // Update the material status
    material.status = 'approved';
    material.approvedQuantity = approvedQuantity || material.quantity;
    material.approvedBy = req.user._id;
    
    if (notes) {
      material.notes = notes;
    }
    
    await material.save();
    
    // Return populated material
    const updatedMaterial = await Material.findById(req.params.id)
      .populate('projectId', 'name location')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username');
    
    res.json({
      message: 'Material request approved successfully',
      material: updatedMaterial
    });
  } catch (error) {
    console.error('Error approving material:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject a material request (admin only)
router.patch('/:id/reject', auth, adminOnly, async (req, res) => {
  try {
    const { notes } = req.body;
    
    const material = await Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ message: 'Material request not found' });
    }
    
    // Update the material status
    material.status = 'rejected';
    material.approvedBy = req.user._id;
    
    if (notes) {
      material.notes = notes;
    }
    
    await material.save();
    
    // Return populated material
    const updatedMaterial = await Material.findById(req.params.id)
      .populate('projectId', 'name location')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username');
    
    res.json({
      message: 'Material request rejected successfully',
      material: updatedMaterial
    });
  } catch (error) {
    console.error('Error rejecting material:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update material received status and add image (fix endpoint name to match frontend)
router.patch('/:id/received', auth, async (req, res) => {
  try {
    const { receivedQuantity, receivedImage, notes } = req.body;
    
    const material = await Material.findById(req.params.id)
      .populate('projectId');
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    
    // Check if user is authorized to update this material
    if (req.user.role === 'supervisor' && 
        material.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this material' });
    }
    
    // Update the material status
    material.status = 'received';
    material.receivedQuantity = receivedQuantity || material.approvedQuantity || material.quantity;
    
    if (receivedImage) {
      material.receivedImage = receivedImage;
    }
    
    if (notes) {
      material.notes = material.notes ? `${material.notes}; ${notes}` : notes;
    }
    
    await material.save();
    
    // Create a transaction record for this material receipt
    const transaction = new Transaction({
      projectId: material.projectId._id,
      type: 'expense',
      category: 'materials',
      amount: (material.receivedQuantity * material.cost),
      date: new Date(),
      description: `Received ${material.receivedQuantity} ${material.unit} of ${material.name}`,
      partyName: material.supplier,
      partyType: 'supplier',
      materialId: material._id,
      status: 'completed',
      createdBy: req.user._id
    });
    
    await transaction.save();
    
    // Return populated material
    const updatedMaterial = await Material.findById(req.params.id)
      .populate('projectId', 'name location')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username');
    
    res.json({
      message: 'Material marked as received successfully',
      material: updatedMaterial
    });
  } catch (error) {
    console.error('Error marking material as received:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update material used status (fix endpoint name to match frontend)
router.patch('/:id/used', auth, async (req, res) => {
  try {
    const { usedQuantity, notes } = req.body;
    
    const material = await Material.findById(req.params.id)
      .populate('projectId');
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    
    // Check if user is authorized to update this material
    if (req.user.role === 'supervisor' && 
        material.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this material' });
    }
    
    // Check if there's enough available material
    const availableQuantity = material.receivedQuantity || material.quantity;
    const currentlyUsed = material.usedQuantity || 0;
    
    if (usedQuantity > availableQuantity - currentlyUsed) {
      return res.status(400).json({ 
        message: 'Insufficient quantity', 
        available: availableQuantity - currentlyUsed 
      });
    }
    
    // Update the material
    material.usedQuantity = currentlyUsed + parseFloat(usedQuantity);
    
    // If all material has been used, update status
    if (material.usedQuantity >= availableQuantity) {
      material.status = 'used';
    }
    
    if (notes) {
      material.notes = material.notes ? `${material.notes}; ${notes}` : notes;
    }
    
    await material.save();
    
    // Return populated material
    const updatedMaterial = await Material.findById(req.params.id)
      .populate('projectId', 'name location')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username');
    
    res.json({
      message: 'Material marked as used successfully',
      material: updatedMaterial
    });
  } catch (error) {
    console.error('Error marking material as used:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a specific material
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, quantity, unit, supplier, cost, date, status, notes } = req.body;
    
    const material = await Material.findById(req.params.id)
      .populate('projectId');
      
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    
    // Check if user is authorized to update this material
    if (req.user.role === 'supervisor' && 
        material.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this material' });
    }
    
    // Only admin can update status directly
    if (status && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update material status' });
    }
    
    // Update the material
    if (name) material.name = name;
    if (quantity) material.quantity = quantity;
    if (unit) material.unit = unit;
    if (supplier) material.supplier = supplier;
    if (cost) material.cost = cost;
    if (date) material.date = date;
    if (status && req.user.role === 'admin') material.status = status;
    if (notes) material.notes = notes;
    
    await material.save();
    
    // Return populated material
    const updatedMaterial = await Material.findById(req.params.id)
      .populate('projectId', 'name location')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username');
    
    res.json({
      message: 'Material updated successfully',
      material: updatedMaterial
    });
  } catch (error) {
    console.error('Error updating material:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific material
router.get('/:id', auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id)
      .populate('projectId', 'name location supervisorId')
      .populate('requestedBy', 'name username')
      .populate('approvedBy', 'name username');
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    
    // Check if user is authorized to view this material
    if (req.user.role === 'supervisor' && 
        material.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this material' });
    }
    
    res.json(material);
  } catch (error) {
    console.error('Error getting material details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
