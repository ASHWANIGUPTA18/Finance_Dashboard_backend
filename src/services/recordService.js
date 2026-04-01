const { db } = require('../models/database');
const { notFound } = require('../utils/errors');

function createRecord({ user_id, amount, type, category, date, description }) {
  const result = db.prepare(
    'INSERT INTO financial_records (user_id, amount, type, category, date, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(user_id, amount, type, category, date, description || null);

  return getRecordById(result.lastInsertRowid);
}

function getRecordById(id) {
  const record = db.prepare(
    'SELECT * FROM financial_records WHERE id = ? AND deleted_at IS NULL'
  ).get(id);
  if (!record) throw notFound('Record not found');
  return record;
}

function listRecords({ page = 1, limit = 20, type, category, date_from, date_to, user_id, search }) {
  let where = 'WHERE deleted_at IS NULL';
  const params = [];

  if (type) { where += ' AND type = ?'; params.push(type); }
  if (category) { where += ' AND category = ?'; params.push(category); }
  if (date_from) { where += ' AND date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND date <= ?'; params.push(date_to); }
  if (user_id) { where += ' AND user_id = ?'; params.push(user_id); }
  if (search) { where += ' AND (description LIKE ? OR category LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM financial_records ${where}`).get(...params).count;
  const offset = (page - 1) * limit;
  const records = db.prepare(
    `SELECT * FROM financial_records ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function updateRecord(id, { amount, type, category, date, description }) {
  const record = db.prepare('SELECT id FROM financial_records WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!record) throw notFound('Record not found');

  const fields = [];
  const params = [];
  if (amount !== undefined) { fields.push('amount = ?'); params.push(amount); }
  if (type !== undefined) { fields.push('type = ?'); params.push(type); }
  if (category !== undefined) { fields.push('category = ?'); params.push(category); }
  if (date !== undefined) { fields.push('date = ?'); params.push(date); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }

  if (fields.length === 0) return getRecordById(id);

  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE financial_records SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return getRecordById(id);
}

function deleteRecord(id, soft = true) {
  const record = db.prepare('SELECT id FROM financial_records WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!record) throw notFound('Record not found');

  if (soft) {
    db.prepare("UPDATE financial_records SET deleted_at = datetime('now') WHERE id = ?").run(id);
  } else {
    db.prepare('DELETE FROM financial_records WHERE id = ?').run(id);
  }
}

module.exports = { createRecord, getRecordById, listRecords, updateRecord, deleteRecord };
