
const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
  supplier: {
    type: String,
  },
  cost: {
    type: Number,
    default: 0,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'received', 'requested', 'rejected', 'used'],
    default: 'requested',
  },
  approvedQuantity: {
    type: Number,
  },
  receivedQuantity: {
    type: Number,
  },
  usedQuantity: {
    type: Number,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: {
    type: String,
  },
  receivedImage: {
    type: String, // URL to the stored image
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add index for faster querying by projectId
materialSchema.index({ projectId: 1 });
materialSchema.index({ status: 1 });

// Ensure proper handling of JSON serialization
materialSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Material = mongoose.model('Material', materialSchema);

module.exports = Material;
