const crypto = require('crypto');

// generates a cryptographically random hex token
const generateToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

// expiry helpers
const inHours = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
const inMinutes = (m) => new Date(Date.now() + m * 60 * 1000);

module.exports = { generateToken, inHours, inMinutes };
