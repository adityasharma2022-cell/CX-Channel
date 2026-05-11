require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const session        = require('express-session');
const path           = require('path');
const http           = require('http');
const { Server }     = require('socket.io');
const SqliteStore    = require('connect-sqlite3')(session);
const db             = require('./database');
const bcrypt = require('bcryptjs');
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ──────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://cx-channel.vercel.app',
    'https://cx-channel.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

app.use(session({
  store:             new SqliteStore({ db: 'sessions.db', dir: '.' }),
  secret:            process.env.SESSION_SECRET || 'cx-channel-secret-key',
  resave:            false,
  saveUninitialized: false,
  cookie:            { 
    maxAge:   1000 * 60 * 60 * 8,
    sameSite: 'none',
    secure:   true
  }
}));

// ─── AUTH MIDDLEWARE ─────────────────────────────────
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Not logged in' });
}

// ─── SOCKET.IO ───────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ─── AUTH ROUTES ─────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ success: true, user: req.session.user });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

// ─── PUBLIC ROUTES ───────────────────────────────────
app.post('/public/requests', async (req, res) => {
  const { name, email, subject, priority, details } = req.body;

  if (!name || !email || !subject) {
    return res.status(400).json({ error: 'Name, email, and subject are required.' });
  }

  const id   = 'REQ-' + Date.now();
  const date = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });

  db.prepare(`
    INSERT INTO requests (id, name, email, subject, priority, status, team, details, date)
    VALUES (?, ?, ?, ?, ?, 'pending', '', ?, ?)
  `).run(id, name, email, subject, priority || 'Medium', details || '', date);

  const newRequest = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);

  // Broadcast to all connected team dashboards instantly
  io.emit('new_request', newRequest);

  res.status(201).json(newRequest);
});

app.get('/public/track', (req, res) => {
  const { email, id } = req.query;
  if (!email && !id) {
    return res.status(400).json({ error: 'Provide an email or request ID.' });
  }
  const rows = id
    ? db.prepare('SELECT id, name, subject, priority, status, date FROM requests WHERE id = ?').all(id)
    : db.prepare('SELECT id, name, subject, priority, status, date FROM requests WHERE email = ? ORDER BY rowid DESC').all(email);
  res.json(rows);
});

// ─── PROTECTED ROUTES ────────────────────────────────
app.get('/requests', requireLogin, (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare('SELECT * FROM requests WHERE status = ? ORDER BY rowid DESC').all(status)
    : db.prepare('SELECT * FROM requests ORDER BY rowid DESC').all();
  res.json(rows);
});

app.get('/requests/:id', requireLogin, (req, res) => {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  res.json(row);
});

app.post('/requests', requireLogin, async (req, res) => {
  const { name, email, subject, priority, team, details } = req.body;

  if (!name || !email || !subject) {
    return res.status(400).json({ error: 'Name, email, and subject are required.' });
  }

  const id   = 'REQ-' + Date.now();
  const date = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });

  db.prepare(`
    INSERT INTO requests (id, name, email, subject, priority, status, team, details, date)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(id, name, email, subject, priority || 'Medium', team || '', details || '', date);

  const newRequest = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);

  // Also broadcast team-submitted requests
  io.emit('new_request', newRequest);

  res.status(201).json(newRequest);
});

app.patch('/requests/:id/status', requireLogin, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'review', 'approved', 'rejected'];

  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const result = db.prepare('UPDATE requests SET status = ? WHERE id = ?')
                   .run(status, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });

  const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);

  // Broadcast status change to all connected clients
  io.emit('status_changed', updated);

  res.json(updated);
});

// ─── SETUP ROUTE ─────────────────────────────────────
app.get('/setup', async (req, res) => {
  const users = [
    { name: 'Admin', email: 'admin@cx.com', password: 'admin123', role: 'admin' },
    { name: 'Sneha Sharma', email: 'sneha@gmail.com', password: 'sneha123', role: 'agent' }
  ];

  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT UNIQUE,
    password TEXT, role TEXT
  )`);

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    db.prepare(`INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`)
      .run(u.name, u.email, hash, u.role);
  }

  res.json({ success: true, message: 'Users created' });
});

// ─── START ───────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`CX Channel backend running at http://localhost:${PORT}`);
});
