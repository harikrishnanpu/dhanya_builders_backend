
const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  dailyWage: {
    type: Number,
    required: true,
  },
  joiningDate: {
    type: Date,
    default: Date.now,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  attendance: [{
    date: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'halfDay'],
      default: 'present'
    },
    hoursWorked: Number,
    overtimeHours: Number,
    notes: String
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Worker = mongoose.model('Worker', workerSchema);

module.exports = Worker;
