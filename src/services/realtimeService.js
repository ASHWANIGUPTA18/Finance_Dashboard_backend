const jwt = require('jsonwebtoken');
const { db } = require('../models/database');

const connectedUsers = new Map();

function setupRealtimeTracking(io) {
  io.on('connection', (socket) => {
    let currentUser = null;

    // Authenticate socket connection
    socket.on('auth', (token) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = db.prepare('SELECT id, email, name, role, status FROM users WHERE id = ?').get(payload.id);

        if (!user || user.status !== 'active') {
          socket.emit('auth_error', { error: 'Invalid or inactive user' });
          return;
        }

        currentUser = user;
        connectedUsers.set(socket.id, {
          socketId: socket.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          connectedAt: new Date().toISOString(),
        });

        socket.emit('auth_success', { user });
        broadcastStatus(io);
      } catch {
        socket.emit('auth_error', { error: 'Invalid token' });
      }
    });

    // Handle dashboard data request
    socket.on('request_dashboard', () => {
      if (!currentUser) return;
      const data = getDashboardSnapshot();
      socket.emit('dashboard_data', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      broadcastStatus(io);
    });
  });
}

function broadcastStatus(io) {
  const users = Array.from(connectedUsers.values());
  const uniqueUsers = [...new Map(users.map(u => [u.userId, u])).values()];

  io.emit('users_online', {
    count: uniqueUsers.length,
    users: uniqueUsers.map(u => ({
      name: u.name,
      role: u.role,
      connectedAt: u.connectedAt,
    })),
  });
}

function getDashboardSnapshot() {
  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
      COUNT(*) AS total_records
    FROM financial_records WHERE deleted_at IS NULL
  `).get();
  summary.net_balance = summary.total_income - summary.total_expenses;

  const categories = db.prepare(`
    SELECT category, type, SUM(amount) AS total, COUNT(*) AS count
    FROM financial_records WHERE deleted_at IS NULL
    GROUP BY category, type ORDER BY total DESC
  `).all();

  const trends = db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
    FROM financial_records
    WHERE deleted_at IS NULL AND date >= date('now', '-12 months')
    GROUP BY month ORDER BY month ASC
  `).all();

  const recent = db.prepare(`
    SELECT fr.*, u.name AS user_name
    FROM financial_records fr
    JOIN users u ON fr.user_id = u.id
    WHERE fr.deleted_at IS NULL
    ORDER BY fr.created_at DESC LIMIT 10
  `).all();

  return { summary, categories, trends, recent };
}

// Broadcast updated dashboard to all connected clients
function broadcastDashboardUpdate(io) {
  const data = getDashboardSnapshot();
  io.emit('dashboard_data', data);
}

module.exports = { setupRealtimeTracking, broadcastDashboardUpdate, connectedUsers };
