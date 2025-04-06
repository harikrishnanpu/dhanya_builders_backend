const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Project = require('../models/Project');
const Worker = require('../models/Worker');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Add a transaction
router.post('/', auth, async (req, res) => {
  try {
    const { 
      projectId, 
      type, 
      category, 
      amount, 
      date, 
      description, 
      paymentMethod,
      reference,
      attachmentUrl,
      partyName,
      partyType,
      workerId
    } = req.body;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Only admin can add transactions, or supervisor for their own projects
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to add transaction to this project' });
    }
    
    // If this is a worker payment, validate the worker exists
    if (workerId) {
      const worker = await Worker.findById(workerId);
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }
    }
    
    // Create transaction
    const transaction = new Transaction({
      projectId,
      type,
      category,
      amount,
      date: date || new Date(),
      description,
      paymentMethod,
      reference,
      attachmentUrl,
      partyName,
      partyType,
      workerId,
      createdBy: req.user._id
    });
    
    await transaction.save();
    
    res.status(201).json({
      message: 'Transaction added successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all transactions (filtered based on user role)
router.get('/', auth, async (req, res) => {
  try {
    const { projectId, type, category, startDate, endDate } = req.query;
    let query = {};
    
    // Filter by project
    if (projectId) {
      query.projectId = projectId;
    }
    
    // Filter by transaction type
    if (type) {
      query.type = type;
    }
    
    // Filter by category
    if (category) {
      query.category = category;
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
    
    // For supervisors, only show transactions for their projects
    if (req.user.role === 'supervisor') {
      // Get projects assigned to this supervisor
      const projects = await Project.find({ supervisorId: req.user._id }).select('_id');
      const projectIds = projects.map(project => project._id);
      
      query.projectId = { $in: projectIds };
    }
    
    const transactions = await Transaction.find(query)
      .populate('projectId', 'name location')
      .populate('createdBy', 'name username')
      .sort({ date: -1 });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get transactions for a specific project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type, startDate, endDate } = req.query;
    
    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to view transactions for this project
    if (req.user.role === 'supervisor' && project.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view transactions for this project' });
    }
    
    let query = { projectId };
    
    // Filter by transaction type
    if (type) {
      query.type = type;
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
    
    const transactions = await Transaction.find(query)
      .populate('createdBy', 'name username')
      .sort({ date: -1 });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get transaction summary by project (total income, expense, balance)
router.get('/summary/project', auth, async (req, res) => {
  try {
    // For supervisors, only summarize their projects
    let projectQuery = {};
    if (req.user.role === 'supervisor') {
      projectQuery.supervisorId = req.user._id;
    }
    
    const projects = await Project.find(projectQuery).select('_id name');
    const projectIds = projects.map(project => project._id);
    
    // Use MongoDB aggregation to calculate summary
    const summary = await Transaction.aggregate([
      {
        $match: {
          projectId: { $in: projectIds }
        }
      },
      {
        $group: {
          _id: {
            projectId: "$projectId",
            type: "$type"
          },
          total: { $sum: "$amount" }
        }
      },
      {
        $group: {
          _id: "$_id.projectId",
          amounts: {
            $push: {
              type: "$_id.type",
              total: "$total"
            }
          }
        }
      }
    ]);
    
    // Convert to more user-friendly format
    const formattedSummary = await Promise.all(summary.map(async (item) => {
      const project = await Project.findById(item._id);
      
      // Find income and expense totals
      const income = item.amounts.find(a => a.type === 'income')?.total || 0;
      const expense = item.amounts.find(a => a.type === 'expense')?.total || 0;
      
      return {
        projectId: item._id,
        projectName: project?.name || 'Unknown Project',
        income,
        expense,
        balance: income - expense
      };
    }));
    
    res.json(formattedSummary);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get transaction by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('projectId', 'name location supervisorId')
      .populate('createdBy', 'name username');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Check if user is authorized to view this transaction
    if (req.user.role === 'supervisor' && 
        transaction.projectId.supervisorId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this transaction' });
    }
    
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a transaction
router.put('/:id', auth, async (req, res) => {
  try {
    const { 
      type, 
      category, 
      amount, 
      date, 
      description, 
      paymentMethod,
      reference,
      attachmentUrl
    } = req.body;
    
    // Find transaction
    const transaction = await Transaction.findById(req.params.id)
      .populate('projectId');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Check if user is authorized to update this transaction
    if (req.user.role === 'supervisor') {
      if (transaction.projectId.supervisorId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this transaction' });
      }
    }
    
    // Update fields
    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (amount !== undefined) transaction.amount = amount;
    if (date) transaction.date = date;
    if (description !== undefined) transaction.description = description;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (reference !== undefined) transaction.reference = reference;
    if (attachmentUrl) transaction.attachmentUrl = attachmentUrl;
    
    await transaction.save();
    
    res.json({
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find transaction
    const transaction = await Transaction.findById(req.params.id)
      .populate('projectId');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Check if user is authorized to delete this transaction
    if (req.user.role === 'supervisor') {
      if (transaction.projectId.supervisorId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this transaction' });
      }
    }
    
    await Transaction.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get worker payment transactions
router.get('/worker/:workerId', auth, async (req, res) => {
  try {
    const { workerId } = req.params;
    
    // Check if the worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // For supervisors, check if they are authorized to view this worker's payments
    if (req.user.role === 'supervisor') {
      const project = await Project.findById(worker.projectId);
      if (!project || project.supervisorId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this worker\'s payments' });
      }
    }
    
    const transactions = await Transaction.find({ 
      workerId,
      type: 'expense',
      category: { $in: ['worker-salary', 'worker-advance'] }
    })
    .populate('projectId', 'name location')
    .populate('createdBy', 'name username')
    .sort({ date: -1 });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a worker's payment summary (total salary, advances)
router.get('/worker/:workerId/summary', auth, async (req, res) => {
  try {
    const { workerId } = req.params;
    
    // Check if the worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    
    // For supervisors, check if they are authorized to view this worker's payment summary
    if (req.user.role === 'supervisor') {
      const project = await Project.findById(worker.projectId);
      if (!project || project.supervisorId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this worker\'s payment summary' });
      }
    }
    
    // Use MongoDB aggregation to calculate summary
    const summary = await Transaction.aggregate([
      {
        $match: { 
          workerId: mongoose.Types.ObjectId.createFromHexString(workerId),
          type: 'expense',
          category: { $in: ['worker-salary', 'worker-advance'] }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    // Format the summary
    const formattedSummary = {
      workerId,
      workerName: worker.name,
      totalSalary: summary.find(item => item._id === 'worker-salary')?.total || 0,
      totalAdvance: summary.find(item => item._id === 'worker-advance')?.total || 0,
    };
    
    res.json(formattedSummary);
  } catch (error) {
    console.error('Error getting worker payment summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
