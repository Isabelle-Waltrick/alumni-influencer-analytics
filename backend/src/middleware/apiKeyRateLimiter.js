const rateLimit = require('express-rate-limit');

// Per-API-key rate limiter — runs AFTER requireApiKey so req.apiKey is already set.
// Using the key's DB _id as the rate limit bucket means each developer gets
// their own independent counter regardless of IP address. Two different developers
// behind the same NAT won't share a limit.

const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute rolling window

  max: parseInt(process.env.API_KEY_RATE_LIMIT || '100', 10),

  // bucket by key ID — express-rate-limit v8 requires skipFailedRequests or
  // a validate skip when overriding keyGenerator without using their IP helper.
  // Since we always have a proper key ID here (requireApiKey runs first),
  // we tell the library to skip the IPv6 fallback validation.
  keyGenerator: (req) => req.apiKey._id.toString(),

  validate: { xForwardedForHeader: false },

  message: {
    message: 'Rate limit exceeded. Maximum 100 requests per minute per API key.',
  },

  // include standard RateLimit-* headers in responses so clients can back off gracefully
  standardHeaders: true,
  legacyHeaders: false,

  // skip successful responses from the count — only failed/errored requests count
  // (optional — comment out if you want all requests counted)
  // skipSuccessfulRequests: false,
});

module.exports = apiKeyRateLimiter;
