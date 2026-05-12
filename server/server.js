require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const db         = require('./database');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const PORT   = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'cx-channel-secret-key';

// ─── EMAIL TRANSPORTER ───────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

async function notifyTeam(request, action) {
  if (!process.env.GMAIL_USER) return;
  const subjects = {
    submitted: 'New Request: ' + request.id,
    approved:  'Approved: '    + request.id,
    rejected:  'Rejected: '    + request.id,
    review:    'Under Review: '+ request.id
  };
  await transporter.sendMail({
    from:    '"CX Channel" <' + process.env.GMAIL_USER + '>',
    to:      process.env.TEAM_EMAIL,
    subject: subjects[action] || 'Update: ' + request.id,
    html: '<div style="font-family:sans-serif;max-width:520px;padding:24px;">'
        + '<h2 style="margin:0 0 8px;">' + request.subject + '</h2>'
        + '<p style="color:#7A7570;margin:0 0 20px;">' + request.id + '</p>'
        + '<table style="width:100%;font-size:14px;border-collapse:collapse;">'
        + '<tr><td style="padding:8px 0;color:#7A7570;width:120px;">Customer</td><td>' + request.name + '</td></tr>'
        + '<tr><td style="padding:8px 0;color:#7A7570;">Email</td><td>' + request.email + '</td></tr>'
        + '<tr><td style="padding:8px 0;color:#7A7570;">Priority</td><td>' + request.priority + '</td></tr>'
        + '<tr><td style="padding:8px 0;color:#7A7570;">Status</td><td><strong>' + action + '</strong></td></tr>'
        + '<tr><td style="padding:8px 0;color:#7A7570;">Date</td><td>' + request.date + '</td></tr>'
        + '</table>'
        + (request.details ? '<div style="margin-top:16px;background:#F5F3EF;padding:12px;border-radius:8px;font-size:14px;">' + request.details + '</div>' : '')
        + '</div>'
  }).catch(console.error);
}

async function notifyCustomer(request, action) {
  if (!process.env.GMAIL_USER) return;
  const content = {
    submitted: { subject: 'We received your request - ' + request.id, heading: 'Your request has been received!',   msg: 'Hi ' + request.name + ', thank you for reaching out. Your request has been logged and our team will review it shortly.' },
    approved:  { subject: 'Your request is approved - '  + request.id, heading: 'Great news - request approved!',    msg: 'Hi ' + request.name + ', your request has been reviewed and approved. Our team will follow up shortly.' },
    rejected:  { subject: 'Update on your request - '    + request.id, heading: 'Request could not be approved',     msg: 'Hi ' + request.name + ', after reviewing your request we were unable to approve it at this time. Please contact us if you have questions.' },
    review:    { subject: 'Your request is under review -'+ request.id, heading: 'We are reviewing your request',    msg: 'Hi ' + request.name + ', your request is currently being reviewed by our team. We will update you soon.' }
  };
  const c = content[action] || content.submitted;
  await transporter.sendMail({
    from:    '"CX Channel" <' + process.env.GMAIL_USER + '>',
    to:      request.email,
    subject: c.subject,
    html: '<div style="font-family:sans-serif;max-width:520px;padding:24px;">'
        + '<h2 style="margin:0 0 8px;">' + c.heading + '</h2>'
        + '<p style="color:#7A7570;margin:0 0 20px;">Reference: ' + request.id + '</p>'
        + '<p style="font-size:15px;line-height:1.7;">' + c.msg + '</p>'
        + '<div style="margin-top:24px;background:#F5F3EF;border-radius:8px;padding:14px;font-size:13px;">'
        + '<strong>Subject:</strong> ' + request.subject + '<br/>'
        + '<strong>Priority:</strong> ' + request.priority + '<br/>'
        + '<strong>Submitted:</strong> ' + request.date
        + '</div>'
        + '<p style="margin-top:32px;font-size:12px;color:#7A7570;">CX Channel - Automated notification. Please do not reply.</p>'
        + '</div>'
  }).catch(console.error);
}

// ─── MIDDLEWARE ───────────────────────────────────────
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

// ─── JWT AUTH MIDDLEWARE ──────────────────────────────
function requireLogin(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── SOCKET.IO ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ─── SETUP ROUTE ─────────────────────────────────────
app.get('/setup', async (req, res) => {
  try {
    db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT)");
    const hash1 = await bcrypt.hash('admin123', 10);
    const hash2 = await bcrypt.hash('sneha123', 10);
    db.prepare("INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run('Admin', 'admin@cx.com', hash1, 'admin');
    db.prepare("INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run('Sneha Sharma', 'sneha@gmail.com', hash2, 'agent');
    res.json({ success: true, message: 'Users ready. Login: sneha@gmail.com / sneha123 or admin@cx.com / admin123' });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─── AUTH ROUTES ─────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '8h' }
  );
  res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/auth/logout', (req, res) => res.json({ success: true }));

app.get('/auth/me', requireLogin, (req, res) => res.json({ user: req.user }));

// ─── PUBLIC ROUTES ────────────────────────────────────
app.post('/public/requests', async (req, res) => {
  const { name, email, subject, priority, details } = req.body;
  if (!name || !email || !subject) return res.status(400).json({ error: 'Name, email, and subject are required.' });
  const id   = 'REQ-' + Date.now();
  const date = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  db.prepare('INSERT INTO requests (id, name, email, subject, priority, status, team, details, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, name, email, subject, priority || 'Medium', 'pending', '', details || '', date);
  const newRequest = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  io.emit('new_request', newRequest);
  notifyTeam(newRequest, 'submitted');
  notifyCustomer(newRequest, 'submitted');
  res.status(201).json(newRequest);
});

app.get('/public/track', (req, res) => {
  const { email, id } = req.query;
  if (!email && !id) return res.status(400).json({ error: 'Provide an email or request ID.' });
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

app.post('/requests', requireLogin, (req, res) => {
  const { name, email, subject, priority, team, details } = req.body;
  if (!name || !email || !subject) return res.status(400).json({ error: 'Name, email, and subject are required.' });
  const id   = 'REQ-' + Date.now();
  const date = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  db.prepare('INSERT INTO requests (id, name, email, subject, priority, status, team, details, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, name, email, subject, priority || 'Medium', 'pending', team || '', details || '', date);
  const newRequest = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  io.emit('new_request', newRequest);
  notifyTeam(newRequest, 'submitted');
  notifyCustomer(newRequest, 'submitted');
  res.status(201).json(newRequest);
});

app.patch('/requests/:id/status', requireLogin, (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'review', 'approved', 'rejected'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const result = db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  io.emit('status_changed', updated);
  notifyTeam(updated, status);
  notifyCustomer(updated, status);
  res.json(updated);
});

// ─── START ────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('CX Channel backend running at http://localhost:' + PORT);
});