// checks that the logged-in user has the alumnus role
// must be used after requireAuth so req.session.userId is guaranteed to exist
const requireAlumnus = (req, res, next) => {
  if (req.session.role !== 'alumnus') {
    return res.status(403).json({
      message: 'Access denied. This section is for alumni accounts only.',
    });
  }
  next();
};

module.exports = requireAlumnus;
