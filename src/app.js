require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const { Server } = require('socket.io');
const { initialize } = require('./models/database');
const { AppError } = require('./utils/errors');
const { setupRealtimeTracking } = require('./services/realtimeService');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// cors - keeping it simple for now, would tighten in prod
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', rateLimiter);

app.set('io', io);

// --- routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/records', require('./routes/records'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// global error handler
app.use((err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  // body-parser throws with status 400 for malformed json
  if (err.status === 400 || err.statusCode === 400) {
    return res.status(400).json({ error: err.message || 'Bad request' });
  }
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Something went wrong' });
});

initialize();
setupRealtimeTracking(io);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Dashboard UI at http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io };
