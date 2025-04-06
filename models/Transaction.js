
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
  },
  paymentMethod: {
    type: String,
  },
  reference: {
    type: String,
  },
  attachmentUrl: {
    type: String,
  },
  partyName: {
    type: String,
  },
  partyType: {
    type: String,
    enum: ['client', 'vendor', 'worker', 'supplier', 'other', null],
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed',
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

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
