const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../models/database');
const { notFound, badRequest } = require('../utils/errors');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '24h';

function createToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function register({ email, password, name, role = 'viewer' }) {
  // check if email is already taken
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw badRequest('Email already registered');

  const hashed = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db.prepare(
    'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)'
  ).run(email, hashed, name, role);

  const user = db.prepare(
    'SELECT id, email, name, role, status, created_at FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);

  return { user, token: createToken(user) };
}

function login({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  // intentionally vague error msg so we don't leak whether email exists
  if (!user) throw badRequest('Invalid email or password');
  if (user.status !== 'active') throw badRequest('Account is inactive');
  if (!bcrypt.compareSync(password, user.password)) {
    throw badRequest('Invalid email or password');
  }

  const { password: _, ...safeUser } = user;
  return { user: safeUser, token: createToken(user) };
}

function listUsers({ page = 1, limit = 20, status, role }) {
  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND status = ?'; params.push(status); }
  if (role)   { where += ' AND role = ?';   params.push(role); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params).count;
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT id, email, name, role, status, created_at, updated_at
    FROM users ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function getUserById(id) {
  const user = db.prepare(
    'SELECT id, email, name, role, status, created_at, updated_at FROM users WHERE id = ?'
  ).get(id);
  if (!user) throw notFound('User not found');
  return user;
}

function updateUser(id, updates) {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) throw notFound('User not found');

  const { name, role, status } = updates;
  const fields = [];
  const params = [];

  if (name !== undefined)   { fields.push('name = ?');   params.push(name); }
  if (role !== undefined)   { fields.push('role = ?');   params.push(role); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }

  if (!fields.length) throw badRequest('Nothing to update');

  fields.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getUserById(id);
}

function deleteUser(id) {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) throw notFound('User not found');

  // TODO: should we cascade-delete their records too? for now just delete the user
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

module.exports = { register, login, listUsers, getUserById, updateUser, deleteUser };
