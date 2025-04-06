
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'halfDay'],
    default: 'present',
  },
  hoursWorked: {
    type: Number,
  },
  dailyWage: {
    type: Number,
    required: true,
  },
  overtimeHours: {
    type: Number,
    default: 0,
  },
  overtimeRate: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
