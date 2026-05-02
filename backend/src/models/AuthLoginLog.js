const mongoose = require('mongoose');

// audit trail for successful session logins
const authLoginLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }
);

authLoginLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AuthLoginLog', authLoginLogSchema);
