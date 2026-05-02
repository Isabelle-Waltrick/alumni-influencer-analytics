// checks that the user has an active session before allowing access
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Login required' });
  }
  next();
};

module.exports = requireAuth;
