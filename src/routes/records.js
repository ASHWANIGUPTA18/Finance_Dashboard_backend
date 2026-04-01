const { Router } = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const recordService = require('../services/recordService');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

router.use(authenticate);

// List records (all authenticated users)
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['income', 'expense']),
  query('category').optional().trim().notEmpty(),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  query('search').optional().trim(),
], validate, (req, res, next) => {
  try {
    const result = recordService.listRecords({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      type: req.query.type,
      category: req.query.category,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      search: req.query.search,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Get single record (all authenticated users)
router.get('/:id', [
  param('id').isInt(),
], validate, (req, res, next) => {
  try {
    const record = recordService.getRecordById(parseInt(req.params.id));
    res.json(record);
  } catch (err) { next(err); }
});

// Create record (admin only)
router.post('/', authorize('admin'), [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('type').isIn(['income', 'expense']),
  body('category').trim().notEmpty(),
  body('date').isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
  body('description').optional().trim(),
], validate, (req, res, next) => {
  try {
    const record = recordService.createRecord({
      ...req.body,
      user_id: req.user.id,
    });
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// Update record (admin only)
router.patch('/:id', authorize('admin'), [
  param('id').isInt(),
  body('amount').optional().isFloat({ gt: 0 }),
  body('type').optional().isIn(['income', 'expense']),
  body('category').optional().trim().notEmpty(),
  body('date').optional().isISO8601(),
  body('description').optional().trim(),
], validate, (req, res, next) => {
  try {
    const record = recordService.updateRecord(parseInt(req.params.id), req.body);
    res.json(record);
  } catch (err) { next(err); }
});

// Delete record (admin only, soft delete)
router.delete('/:id', authorize('admin'), [
  param('id').isInt(),
], validate, (req, res, next) => {
  try {
    recordService.deleteRecord(parseInt(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
