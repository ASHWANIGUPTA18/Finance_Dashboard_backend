require('dotenv').config();
const { db, initialize } = require('./models/database');
const bcrypt = require('bcryptjs');

initialize();

// Clear existing data
db.exec('DELETE FROM financial_records; DELETE FROM users;');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Seed users
const insertUser = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)');
const users = [
  { email: 'admin@example.com', password: hash('admin123'), name: 'Admin User', role: 'admin' },
  { email: 'analyst@example.com', password: hash('analyst123'), name: 'Analyst User', role: 'analyst' },
  { email: 'viewer@example.com', password: hash('viewer123'), name: 'Viewer User', role: 'viewer' },
];

const insertMany = db.transaction(() => {
  for (const u of users) insertUser.run(u.email, u.password, u.name, u.role);
});
insertMany();

// Seed financial records
const insertRecord = db.prepare(
  'INSERT INTO financial_records (user_id, amount, type, category, date, description) VALUES (?, ?, ?, ?, ?, ?)'
);

const categories = {
  income: ['Salary', 'Freelance', 'Investment', 'Refund'],
  expense: ['Rent', 'Utilities', 'Food', 'Transport', 'Entertainment', 'Healthcare'],
};

const records = [];
for (let m = 0; m < 6; m++) {
  const month = String(m + 1).padStart(2, '0');
  // Income entries
  records.push([1, 5000, 'income', 'Salary', `2026-${month}-01`, `Salary for month ${m + 1}`]);
  records.push([1, 800 + Math.floor(Math.random() * 500), 'income', 'Freelance', `2026-${month}-15`, 'Freelance project']);
  // Expense entries
  records.push([1, 1500, 'expense', 'Rent', `2026-${month}-05`, 'Monthly rent']);
  records.push([1, 200 + Math.floor(Math.random() * 100), 'expense', 'Utilities', `2026-${month}-10`, 'Electricity and water']);
  records.push([1, 300 + Math.floor(Math.random() * 200), 'expense', 'Food', `2026-${month}-12`, 'Groceries']);
  records.push([1, 100 + Math.floor(Math.random() * 150), 'expense', 'Transport', `2026-${month}-20`, 'Commute']);
}

const insertRecords = db.transaction(() => {
  for (const r of records) insertRecord.run(...r);
});
insertRecords();

console.log(`Seeded ${users.length} users and ${records.length} financial records.`);
console.log('\nTest credentials:');
console.log('  Admin:   admin@example.com / admin123');
console.log('  Analyst: analyst@example.com / analyst123');
console.log('  Viewer:  viewer@example.com / viewer123');
