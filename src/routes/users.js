const { Router } = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const userService = require('../services/userService');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

router.use(authenticate);

// Get current user profile
router.get('/me', (req, res) => {
  res.json(req.user);
});

// List users (admin only)
router.get('/', authorize('admin'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['active', 'inactive']),
  query('role').optional().isIn(['admin', 'analyst', 'viewer']),
], validate, (req, res, next) => {
  try {
    const result = userService.listUsers({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      role: req.query.role,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Get user by ID (admin only)
router.get('/:id', authorize('admin'), [
  param('id').isInt(),
], validate, (req, res, next) => {
  try {
    const user = userService.getUserById(parseInt(req.params.id));
    res.json(user);
  } catch (err) { next(err); }
});

// Update user (admin only)
router.patch('/:id', authorize('admin'), [
  param('id').isInt(),
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['admin', 'analyst', 'viewer']),
  body('status').optional().isIn(['active', 'inactive']),
], validate, (req, res, next) => {
  try {
    const user = userService.updateUser(parseInt(req.params.id), req.body);
    res.json(user);
  } catch (err) { next(err); }
});

// Delete user (admin only)
router.delete('/:id', authorize('admin'), [
  param('id').isInt(),
], validate, (req, res, next) => {
  try {
    userService.deleteUser(parseInt(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
