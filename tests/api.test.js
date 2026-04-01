const request = require('supertest');

// Use in-memory DB for tests
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const { initialize } = require('../src/models/database');
initialize();

const { app } = require('../src/app');

let adminToken, analystToken, viewerToken;

describe('Auth', () => {
  test('POST /api/auth/register - creates admin user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'admin@test.com', password: 'password123', name: 'Admin', role: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    adminToken = res.body.token;
  });

  test('POST /api/auth/register - creates analyst user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'analyst@test.com', password: 'password123', name: 'Analyst', role: 'analyst',
    });
    expect(res.status).toBe(201);
    analystToken = res.body.token;
  });

  test('POST /api/auth/register - creates viewer user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'viewer@test.com', password: 'password123', name: 'Viewer', role: 'viewer',
    });
    expect(res.status).toBe(201);
    viewerToken = res.body.token;
  });

  test('POST /api/auth/register - rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'admin@test.com', password: 'password123', name: 'Dup',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register - rejects invalid input', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email', password: '123', name: '',
    });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  test('POST /api/auth/login - succeeds with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com', password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/login - fails with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com', password: 'wrong',
    });
    expect(res.status).toBe(400);
  });
});

describe('Users', () => {
  test('GET /api/users/me - returns current user', async () => {
    const res = await request(app).get('/api/users/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.com');
  });

  test('GET /api/users - admin can list users', async () => {
    const res = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(3);
  });

  test('GET /api/users - viewer cannot list users', async () => {
    const res = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  test('PATCH /api/users/:id - admin can update user', async () => {
    const res = await request(app).patch('/api/users/3')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Viewer' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Viewer');
  });

  test('GET /api/users - unauthenticated request rejected', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

describe('Financial Records', () => {
  let recordId;

  test('POST /api/records - admin can create record', async () => {
    const res = await request(app).post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 5000, type: 'income', category: 'Salary', date: '2026-01-15', description: 'Jan salary' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(5000);
    recordId = res.body.id;
  });

  test('POST /api/records - creates expense record', async () => {
    const res = await request(app).post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1200, type: 'expense', category: 'Rent', date: '2026-01-05' });
    expect(res.status).toBe(201);
  });

  test('POST /api/records - viewer cannot create record', async () => {
    const res = await request(app).post('/api/records')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ amount: 100, type: 'income', category: 'Test', date: '2026-01-01' });
    expect(res.status).toBe(403);
  });

  test('POST /api/records - rejects invalid data', async () => {
    const res = await request(app).post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: -5, type: 'invalid', category: '', date: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  test('GET /api/records - all users can list records', async () => {
    const res = await request(app).get('/api/records')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBeGreaterThan(0);
  });

  test('GET /api/records - filtering by type works', async () => {
    const res = await request(app).get('/api/records?type=income')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    res.body.records.forEach(r => expect(r.type).toBe('income'));
  });

  test('GET /api/records/:id - get single record', async () => {
    const res = await request(app).get(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(recordId);
  });

  test('PATCH /api/records/:id - admin can update record', async () => {
    const res = await request(app).patch(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 5500 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(5500);
  });

  test('DELETE /api/records/:id - admin can soft delete record', async () => {
    const res = await request(app).delete(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  test('GET /api/records/:id - deleted record not accessible', async () => {
    const res = await request(app).get(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Dashboard', () => {
  beforeAll(async () => {
    // Add records for dashboard tests
    await request(app).post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 3000, type: 'income', category: 'Freelance', date: '2026-02-10' });
    await request(app).post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 500, type: 'expense', category: 'Food', date: '2026-02-15' });
  });

  test('GET /api/dashboard/summary - returns totals', async () => {
    const res = await request(app).get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total_income).toBeDefined();
    expect(res.body.total_expenses).toBeDefined();
    expect(res.body.net_balance).toBeDefined();
  });

  test('GET /api/dashboard/categories - returns category breakdown', async () => {
    const res = await request(app).get('/api/dashboard/categories')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/dashboard/trends - returns monthly trends', async () => {
    const res = await request(app).get('/api/dashboard/trends')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/dashboard/recent - returns recent activity', async () => {
    const res = await request(app).get('/api/dashboard/recent')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/dashboard/summary - viewer cannot access dashboard', async () => {
    const res = await request(app).get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/dashboard/summary - supports date filtering', async () => {
    const res = await request(app).get('/api/dashboard/summary?date_from=2026-02-01&date_to=2026-02-28')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total_income).toBe(3000);
  });
});

describe('Edge cases', () => {
  test('GET /api/nonexistent - returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  test('Invalid JSON body returns error', async () => {
    const res = await request(app).post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('not json{');
    expect(res.status).toBe(400);
  });

  test('GET /api/health - returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
