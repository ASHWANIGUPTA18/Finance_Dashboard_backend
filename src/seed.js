require('dotenv').config();
const { db, initialize } = require('./models/database');
const bcrypt = require('bcryptjs');

initialize();

// Clear existing data
db.pragma('foreign_keys = OFF');
db.exec(`
  DELETE FROM financial_records;
  DELETE FROM users;
  DELETE FROM sqlite_sequence WHERE name IN ('users', 'financial_records');
`);
db.pragma('foreign_keys = ON');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Seed users
const insertUser = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)');
const adminId = insertUser.run('admin@example.com', hash('admin123'), 'Admin User', 'admin').lastInsertRowid;
insertUser.run('analyst@example.com', hash('analyst123'), 'Analyst User', 'analyst');
insertUser.run('viewer@example.com', hash('viewer123'), 'Viewer User', 'viewer');

// Seed financial records
const insertRecord = db.prepare(
  'INSERT INTO financial_records (user_id, amount, type, category, date, description) VALUES (?, ?, ?, ?, ?, ?)'
);

const seedRecords = db.transaction(() => {
  for (let m = 0; m < 6; m++) {
    const month = String(m + 1).padStart(2, '0');
    insertRecord.run(adminId, 5000, 'income', 'Salary', `2026-${month}-01`, `Salary for month ${m + 1}`);
    insertRecord.run(adminId, 800 + Math.floor(Math.random() * 500), 'income', 'Freelance', `2026-${month}-15`, 'Freelance project');
    insertRecord.run(adminId, 1500, 'expense', 'Rent', `2026-${month}-05`, 'Monthly rent');
    insertRecord.run(adminId, 200 + Math.floor(Math.random() * 100), 'expense', 'Utilities', `2026-${month}-10`, 'Electricity and water');
    insertRecord.run(adminId, 300 + Math.floor(Math.random() * 200), 'expense', 'Food', `2026-${month}-12`, 'Groceries');
    insertRecord.run(adminId, 100 + Math.floor(Math.random() * 150), 'expense', 'Transport', `2026-${month}-20`, 'Commute');
  }
});
seedRecords();

console.log(`Seeded 3 users and 36 financial records (admin user id: ${adminId}).`);
console.log('\nTest credentials:');
console.log('  Admin:   admin@example.com / admin123');
console.log('  Analyst: analyst@example.com / analyst123');
console.log('  Viewer:  viewer@example.com / viewer123');
