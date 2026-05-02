const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const ApiUsageLog = require('../models/ApiUsageLog');

// Validates bearer token and logs every request for usage stats.
// statusCode is captured after the response finishes — not before — so the log
// reflects what was actually returned, not just that the key was valid.

const requireApiKey = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'API key required' });
  }

  const rawKey = authHeader.split(' ')[1];

  try {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await ApiKey.findOne({ keyHash, isRevoked: false });

    if (!apiKey) {
      return res.status(401).json({ message: 'Invalid or revoked API key' });
    }

    // attach to request so controllers can read key metadata if needed
    req.apiKey = apiKey;

    // update lastUsedAt before responding
    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    // log after response so we capture the actual status code
    res.on('finish', () => {
      ApiUsageLog.create({
        apiKeyId: apiKey._id,
        endpoint: req.originalUrl,
        method: req.method,
        ipAddress: req.ip,
        statusCode: res.statusCode,
      }).catch((err) => console.error('[usage-log] Failed to write log:', err));
    });

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = requireApiKey;
