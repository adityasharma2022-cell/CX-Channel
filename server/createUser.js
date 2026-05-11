const bcrypt   = require('bcryptjs');
const Database = require('better-sqlite3');

const db = new Database('cx_channel.db');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    email    TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT DEFAULT 'agent'
  )
`);

// Add your team members here
const teamMembers = [
  { name: 'Sneha Sharma',  email: 'sneha@fastech.com',  password: 'sneha123',  role: 'admin' },
  { name: 'Team Agent',    email: 'agent@fastech.com',  password: 'agent123',  role: 'agent' }
];

teamMembers.forEach(member => {
  const hash = bcrypt.hashSync(member.password, 10);
  try {
    db.prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `).run(member.name, member.email, hash, member.role);
    console.log(`Created user: ${member.email}`);
  } catch (err) {
    console.log(`User already exists: ${member.email}`);
  }
});

console.log('Done. You can now log in.');
process.exit();
