const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const userService = require('../services/userService');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().notEmpty(),
  body('role').optional().isIn(['admin', 'analyst', 'viewer']),
], validate, (req, res, next) => {
  try {
    const result = userService.register(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, (req, res, next) => {
  try {
    const result = userService.login(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
