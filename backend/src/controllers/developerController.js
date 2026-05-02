const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const ApiUsageLog = require('../models/ApiUsageLog');
const AuthLoginLog = require('../models/AuthLoginLog');

// ─── POST /api/developer/keys ─────────────────────────────────────────────────
// Generates a new API key for the logged-in user.
// The raw key is returned ONCE — it is never stored in plain text.
// After this response, only the prefix is retrievable.

const generateKey = async (req, res, next) => {
  try {
    const { label, scopes, clientName } = req.body;

    // format: ak_<64 hex chars>  — "ak_" prefix makes it easy to spot in logs
    const rawKey = 'ak_' + crypto.randomBytes(32).toString('hex');

    // store SHA-256 hash — same algorithm used in requireApiKey middleware
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // first 12 chars shown in future listings e.g. "ak_3f9a1b2c..."
    const keyPrefix = rawKey.substring(0, 12) + '...';

    const apiKey = await ApiKey.create({
      userId: req.session.userId,
      keyHash,
      keyPrefix,
      label: label || 'My API Key',
      clientName: clientName || 'custom-client',
      scopes: Array.isArray(scopes) && scopes.length ? scopes : ['read:alumni_of_day'],
    });

    res.status(201).json({
      message: 'API key generated. Copy it now — it will not be shown again.',
      key: rawKey,         // plain key returned once only
      keyId: apiKey._id,
      keyPrefix,
      label: apiKey.label,
      clientName: apiKey.clientName,
      scopes: apiKey.scopes,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/developer/keys ──────────────────────────────────────────────────
// Lists all API keys for the logged-in user.
// Only the prefix is shown — the full key is never retrievable after creation.

const listKeys = async (req, res, next) => {
  try {
    const keys = await ApiKey.find({ userId: req.session.userId })
      .select('keyPrefix label clientName scopes isRevoked lastUsedAt createdAt')
      .sort({ createdAt: -1 });

    res.json(keys);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/developer/keys/:id ──────────────────────────────────────────
// Revokes a key — sets isRevoked = true.
// The key record is kept so usage logs remain intact.

const revokeKey = async (req, res, next) => {
  try {
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({ _id: id, userId: req.session.userId });

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found.' });
    }

    if (apiKey.isRevoked) {
      return res.status(400).json({ message: 'This key is already revoked.' });
    }

    apiKey.isRevoked = true;
    await apiKey.save();

    res.json({ message: 'API key revoked. Any requests using this key will now be rejected.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/developer/stats ─────────────────────────────────────────────────
// Returns usage statistics for all keys owned by the logged-in user.
// Shows per-key summary and a breakdown of endpoints accessed.

const getStats = async (req, res, next) => {
  try {
    // get all key IDs for this user
    const keys = await ApiKey.find({ userId: req.session.userId }).select('_id keyPrefix label isRevoked lastUsedAt');
    const keyIds = keys.map((k) => k._id);

    if (keyIds.length === 0) {
      return res.json({ keys: [], endpointBreakdown: [] });
    }

    // total requests per key
    const perKey = await ApiUsageLog.aggregate([
      { $match: { apiKeyId: { $in: keyIds } } },
      {
        $group: {
          _id: '$apiKeyId',
          totalRequests: { $sum: 1 },
          lastAccessed: { $max: '$timestamp' },
          firstAccessed: { $min: '$timestamp' },
        },
      },
    ]);

    // build a lookup so we can attach key metadata to the stats
    const keyMap = {};
    for (const k of keys) {
      keyMap[k._id.toString()] = k;
    }

    const keyStats = perKey.map((entry) => {
      const meta = keyMap[entry._id.toString()] || {};
      return {
        keyId: entry._id,
        keyPrefix: meta.keyPrefix,
        label: meta.label,
        isRevoked: meta.isRevoked,
        totalRequests: entry.totalRequests,
        firstAccessed: entry.firstAccessed,
        lastAccessed: entry.lastAccessed,
      };
    });

    // add in any keys with zero requests
    const usedKeyIds = new Set(perKey.map((e) => e._id.toString()));
    for (const k of keys) {
      if (!usedKeyIds.has(k._id.toString())) {
        keyStats.push({
          keyId: k._id,
          keyPrefix: k.keyPrefix,
          label: k.label,
          isRevoked: k.isRevoked,
          totalRequests: 0,
          firstAccessed: null,
          lastAccessed: null,
        });
      }
    }

    // endpoint breakdown across all keys
    const endpointBreakdown = await ApiUsageLog.aggregate([
      { $match: { apiKeyId: { $in: keyIds } } },
      {
        $group: {
          _id: { endpoint: '$endpoint', method: '$method' },
          count: { $sum: 1 },
          lastHit: { $max: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      keys: keyStats,
      endpointBreakdown: endpointBreakdown.map((e) => ({
        endpoint: e._id.endpoint,
        method: e._id.method,
        count: e.count,
        lastHit: e.lastHit,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/developer/login-stats ───────────────────────────────────────────
// Returns login counts/timestamps for the current user account.
const getLoginStats = async (req, res, next) => {
  try {
    const rows = await AuthLoginLog.find({ userId: req.session.userId })
      .select('email ipAddress userAgent timestamp')
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      totalLogins: rows.length,
      lastLoginAt: rows.length ? rows[0].timestamp : null,
      entries: rows,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { generateKey, listKeys, revokeKey, getStats, getLoginStats };
