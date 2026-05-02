// Guards Bearer-token routes by required API key scope(s).
// Usage: requireApiScope('read:analytics') or requireApiScope('read:alumni', 'read:analytics')
const requireApiScope = (...requiredScopes) => (req, res, next) => {
  if (!req.apiKey) {
    return res.status(401).json({ message: 'API key context missing' });
  }

  const keyScopes = Array.isArray(req.apiKey.scopes) ? req.apiKey.scopes : [];
  const hasScope = requiredScopes.some((scope) => keyScopes.includes(scope));

  if (!hasScope) {
    return res.status(403).json({
      message: 'Insufficient API key scope for this endpoint',
      requiredAnyOf: requiredScopes,
    });
  }

  next();
};

module.exports = requireApiScope;
