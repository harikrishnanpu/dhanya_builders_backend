const express = require('express');
const Attendance = require('../models/Attendance');
const Worker = require('../models/Worker');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Add attendance record
router.post('/', auth, async (req, res) => {
  try {
    const { 
      projectId, 
      workerId, 
      date, 
      status, 
      hoursWorked, 
      dailyWage,
      overtimeHours,
      overtimeRate,
      notes 
    } = req.body;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to add attendance for this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to add attendance to this project' });
    }
    
    // Check if the worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // Check if attendance already exists for this worker on this date
    const existingAttendance = await Attendance.findOne({
      projectId,
      workerId,
      date: new Date(date)
    });
    
    if (existingAttendance) {
      return res.status(400).json({ message: 'Attendance already marked for this worker on this date' });
    }
    
    // Create attendance record
    const attendance = new Attendance({
      projectId,
      workerId,
      date: new Date(date),
      status,
      hoursWorked,
      dailyWage: dailyWage || worker.dailyWage,
      overtimeHours,
      overtimeRate,
      notes,
      createdBy: req.user._id
    });
    
    await attendance.save();
    
    res.status(201).json({
      message: 'Attendance added successfully',
      attendance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all attendance records (admin only)
router.get('/', auth, async (req, res) => {
  try {
    const { projectId, workerId, startDate, endDate, status } = req.query;
    let query = {};
    
    // Filter by project
    if (projectId) {
      query.projectId = projectId;
    }
    
    // Filter by worker
    if (workerId) {
      query.workerId = workerId;
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    // For supervisors, only show attendance for their projects
    if (req.user.role === 'supervisor') {
      // Get projects assigned to this supervisor
      const projects = await Project.find({ supervisorId: req.user._id }).select('_id');
      const projectIds = projects.map(project => project._id);
      
      query.projectId = { $in: projectIds };
    }
    
    const attendance = await Attendance.find(query)
      .populate('projectId', 'name location')
      .populate('workerId', 'name role dailyWage')
      .populate('createdBy', 'name username')
      .sort({ date: -1 });
    
    // Enrich with worker names for frontend
    const enrichedAttendance = attendance.map(record => {
      return {
        ...record.toObject(),
        workerName: record.workerId?.name || 'Unknown Worker',
        projectName: record.projectId?.name || 'Unknown Project'
      };
    });
    
    res.json(enrichedAttendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance records for a specific project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate, workerId, status } = req.query;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to view attendance for this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view attendance for this project' });
    }
    
    let query = { projectId };
    
    // Filter by worker id
    if (workerId && workerId !== 'all') {
      query.workerId = workerId;
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    const attendance = await Attendance.find(query)
      .populate('workerId', 'name role dailyWage')
      .populate('createdBy', 'name username')
      .sort({ date: -1 });
    
    // Enrich with worker names for frontend
    const enrichedAttendance = attendance.map(record => {
      return {
        ...record.toObject(),
        workerName: record.workerId?.name || 'Unknown Worker'
      };
    });
    
    res.json(enrichedAttendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get attendance records for a specific worker
router.get('/worker/:workerId', auth, async (req, res) => {
  try {
    const { workerId } = req.params;
    const { startDate, endDate, projectId } = req.query;
    
    // Check if the worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    let query = { workerId };
    
    // Filter by project
    if (projectId) {
      query.projectId = projectId;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    // For supervisors, only show attendance for their projects
    if (req.user.role === 'supervisor') {
      // Get projects assigned to this supervisor
      const projects = await Project.find({ supervisorId: req.user._id }).select('_id');
      const projectIds = projects.map(project => project._id);
      
      if (!query.projectId) {
        query.projectId = { $in: projectIds };
      } else if (!projectIds.includes(query.projectId)) {
        return res.status(403).json({ message: 'Not authorized to view attendance for this worker on this project' });
      }
    }
    
    const attendance = await Attendance.find(query)
      .populate('projectId', 'name location')
      .populate('createdBy', 'name username')
      .sort({ date: -1 });
    
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an attendance record
router.put('/:id', auth, async (req, res) => {
  try {
    const { 
      status, 
      hoursWorked, 
      dailyWage,
      overtimeHours,
      overtimeRate,
      notes 
    } = req.body;
    
    // Find attendance record
    const attendance = await Attendance.findById(req.params.id)
      .populate('projectId');
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    // Check if user is authorized to update this attendance
    if (req.user.role === 'supervisor' && 
        attendance.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this attendance record' });
    }
    
    // Update fields
    if (status) attendance.status = status;
    if (hoursWorked !== undefined) attendance.hoursWorked = hoursWorked;
    if (dailyWage !== undefined) attendance.dailyWage = dailyWage;
    if (overtimeHours !== undefined) attendance.overtimeHours = overtimeHours;
    if (overtimeRate !== undefined) attendance.overtimeRate = overtimeRate;
    if (notes) attendance.notes = notes;
    
    await attendance.save();
    
    res.json({
      message: 'Attendance record updated successfully',
      attendance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete an attendance record
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find attendance record
    const attendance = await Attendance.findById(req.params.id)
      .populate('projectId');
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    // Check if user is authorized to delete this attendance
    if (req.user.role === 'supervisor' && 
        attendance.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this attendance record' });
    }
    
    await Attendance.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Make a payment to a worker
router.post('/worker-payment', auth, async (req, res) => {
  try {
    const { 
      workerId, 
      projectId, 
      amount, 
      paymentType, 
      description, 
      paymentMethod 
    } = req.body;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized for this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to make payments for this project' });
    }
    
    // Check if the worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // Create transaction record
    const transaction = new Transaction({
      projectId,
      type: 'expense',
      category: paymentType === 'advance' ? 'worker-advance' : 'worker-salary',
      amount,
      description: description || `Payment to ${worker.name}: ${paymentType}`,
      paymentMethod,
      partyName: worker.name,
      partyType: 'worker',
      workerId,
      status: 'completed',
      date: new Date(),
      createdBy: req.user._id
    });
    
    await transaction.save();
    
    res.status(201).json({
      message: 'Worker payment processed successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
