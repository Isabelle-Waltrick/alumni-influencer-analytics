const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // first few chars of the key shown in listings (e.g. "ak_3f9a...")
    // never store the full plain key — only the hash below
    keyPrefix: {
      type: String,
      required: true,
    },

    // bcrypt or sha256 hash of the actual key
    keyHash: {
      type: String,
      required: true,
    },

    // friendly name the developer gives their key
    label: {
      type: String,
      trim: true,
      default: 'My API Key',
    },

    // per-client permission scopes to enforce least privilege
    scopes: {
      type: [String],
      enum: ['read:alumni', 'read:analytics', 'read:donations', 'read:alumni_of_day'],
      default: ['read:alumni_of_day'],
    },

    // optional client label (analytics-dashboard, mobile-ar, etc.)
    clientName: {
      type: String,
      trim: true,
      default: 'custom-client',
    },

    isRevoked: {
      type: Boolean,
      default: false,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ApiKey', apiKeySchema);
