
const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const Project = require('../models/Project');

const router = express.Router();

// Get all tasks
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    // If user is a supervisor, only show their projects' tasks
    if (req.user.role === 'supervisor') {
      const projects = await Project.find({ supervisorId: req.user._id });
      const projectIds = projects.map(p => p._id);
      query = { projectId: { $in: projectIds } };
    }
    
    // We'll collect tasks from all projects
    const projects = await Project.find(query)
      .populate('supervisorId', 'name username');
    
    // Extract all tasks from all projects
    const tasks = [];
    projects.forEach(project => {
      if (project.tasks && project.tasks.length > 0) {
        project.tasks.forEach(task => {
          tasks.push({
            id: task._id,
            title: task.title,
            description: task.description,
            completed: task.completed,
            projectId: project._id,
            projectName: project.name,
            createdAt: task.createdAt,
            dueDate: task.dueDate
          });
        });
      }
    });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get all tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new task for a project
router.post('/', auth, async (req, res) => {
  try {
    const { projectId, title, description, dueDate } = req.body;
    
    if (!projectId || !title) {
      return res.status(400).json({ message: 'Project ID and task title are required' });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to add tasks to this project
    if (req.user.role === 'supervisor' && project.supervisorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to add tasks to this project' });
    }
    
    const newTask = {
      title,
      description,
      completed: false,
      dueDate,
      createdAt: new Date()
    };
    
    project.tasks.push(newTask);
    await project.save();
    
    const addedTask = project.tasks[project.tasks.length - 1];
    
    res.status(201).json({
      message: 'Task created successfully',
      task: {
        id: addedTask._id,
        title: addedTask.title,
        description: addedTask.description,
        completed: addedTask.completed,
        projectId: project._id,
        projectName: project.name,
        createdAt: addedTask.createdAt,
        dueDate: addedTask.dueDate
      }
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update task status (mark as completed/incomplete)
router.patch('/:projectId/:taskId/status', auth, async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { completed } = req.body;
    
    if (completed === undefined) {
      return res.status(400).json({ message: 'Completed status is required' });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to update tasks in this project
    if (req.user.role === 'supervisor' && project.supervisorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update tasks in this project' });
    }
    
    const taskIndex = project.tasks.findIndex(task => task._id.toString() === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    project.tasks[taskIndex].completed = completed;
    await project.save();
    
    res.json({
      message: 'Task status updated successfully',
      task: {
        id: project.tasks[taskIndex]._id,
        title: project.tasks[taskIndex].title,
        description: project.tasks[taskIndex].description,
        completed: project.tasks[taskIndex].completed,
        projectId: project._id,
        projectName: project.name,
        createdAt: project.tasks[taskIndex].createdAt,
        dueDate: project.tasks[taskIndex].dueDate
      }
    });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a task
router.delete('/:projectId/:taskId', auth, async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to delete tasks in this project
    if (req.user.role === 'supervisor' && project.supervisorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete tasks in this project' });
    }
    
    const taskIndex = project.tasks.findIndex(task => task._id.toString() === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    project.tasks.splice(taskIndex, 1);
    await project.save();
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
