const { db } = require('../models/database');

function getSummary({ date_from, date_to } = {}) {
  let where = 'WHERE deleted_at IS NULL';
  const params = [];
  if (date_from) { where += ' AND date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND date <= ?'; params.push(date_to); }

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
      COUNT(*) AS total_records
    FROM financial_records ${where}
  `).get(...params);

  totals.net_balance = totals.total_income - totals.total_expenses;
  return totals;
}

function getCategoryTotals({ date_from, date_to, type } = {}) {
  let where = 'WHERE deleted_at IS NULL';
  const params = [];
  if (date_from) { where += ' AND date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND date <= ?'; params.push(date_to); }
  if (type) { where += ' AND type = ?'; params.push(type); }

  return db.prepare(`
    SELECT category, type, SUM(amount) AS total, COUNT(*) AS count
    FROM financial_records ${where}
    GROUP BY category, type
    ORDER BY total DESC
  `).all(...params);
}

function getMonthlyTrends({ months = 12 } = {}) {
  return db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net,
      COUNT(*) AS record_count
    FROM financial_records
    WHERE deleted_at IS NULL
      AND date >= date('now', '-' || ? || ' months')
    GROUP BY month
    ORDER BY month ASC
  `).all(months);
}

function getRecentActivity(limit = 10) {
  return db.prepare(`
    SELECT fr.*, u.name AS user_name
    FROM financial_records fr
    JOIN users u ON fr.user_id = u.id
    WHERE fr.deleted_at IS NULL
    ORDER BY fr.created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = { getSummary, getCategoryTotals, getMonthlyTrends, getRecentActivity };
