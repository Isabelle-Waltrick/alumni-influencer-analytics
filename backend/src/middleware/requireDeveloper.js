// checks that the logged-in user has the developer role
// must be used after requireAuth so req.session.userId is guaranteed to exist
const requireDeveloper = (req, res, next) => {
  if (req.session.role !== 'developer') {
    return res.status(403).json({
      message: 'Access denied. This section is for developer accounts only.',
    });
  }
  next();
};

module.exports = requireDeveloper;
