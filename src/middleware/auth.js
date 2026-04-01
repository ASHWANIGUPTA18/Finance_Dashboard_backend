const jwt = require('jsonwebtoken');
const { db } = require('../models/database');
const { unauthorized, forbidden } = require('../utils/errors');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Missing or invalid authorization header'));
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, role, status FROM users WHERE id = ?').get(payload.id);

    if (!user) return next(unauthorized('User not found'));
    if (user.status !== 'active') return next(forbidden('Account is inactive'));

    req.user = user;
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`Role '${req.user.role}' is not allowed to perform this action`));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
