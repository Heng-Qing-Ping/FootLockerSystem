
function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  } else {
    res.status(403).send('Access denied: Admins only.');
  }
}

module.exports = { isLoggedIn, isAdmin };
