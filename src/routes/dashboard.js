const { Router } = require('express');
const { query, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const dashboardService = require('../services/dashboardService');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

router.use(authenticate);
router.use(authorize('admin', 'analyst'));

// Overall summary
router.get('/summary', [
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
], validate, (req, res, next) => {
  try {
    const summary = dashboardService.getSummary({
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    });
    res.json(summary);
  } catch (err) { next(err); }
});

// Category-wise breakdown
router.get('/categories', [
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  query('type').optional().isIn(['income', 'expense']),
], validate, (req, res, next) => {
  try {
    const categories = dashboardService.getCategoryTotals({
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      type: req.query.type,
    });
    res.json(categories);
  } catch (err) { next(err); }
});

// Monthly trends
router.get('/trends', [
  query('months').optional().isInt({ min: 1, max: 60 }),
], validate, (req, res, next) => {
  try {
    const trends = dashboardService.getMonthlyTrends({
      months: parseInt(req.query.months) || 12,
    });
    res.json(trends);
  } catch (err) { next(err); }
});

// Recent activity
router.get('/recent', [
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, (req, res, next) => {
  try {
    const recent = dashboardService.getRecentActivity(
      parseInt(req.query.limit) || 10
    );
    res.json(recent);
  } catch (err) { next(err); }
});

module.exports = router;
