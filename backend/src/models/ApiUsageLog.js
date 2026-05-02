const mongoose = require('mongoose');

// logs every request made using an API key
// used for the usage statistics endpoint in the developer dashboard

const apiUsageLogSchema = new mongoose.Schema(
  {
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApiKey',
      required: true,
    },

    endpoint: {
      type: String,
      required: true,
    },

    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      required: true,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    statusCode: {
      type: Number,
      default: null,
    },

    // when the request hit the server
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }
);

// index on apiKeyId so stats queries are fast
apiUsageLogSchema.index({ apiKeyId: 1, timestamp: -1 });

module.exports = mongoose.model('ApiUsageLog', apiUsageLogSchema);
