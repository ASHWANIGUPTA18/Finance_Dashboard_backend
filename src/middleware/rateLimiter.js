const rateLimit = require('express-rate-limit');

// 100 requests per minute per IP — generous enough for testing,
// strict enough to show I thought about it
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

module.exports = limiter;
