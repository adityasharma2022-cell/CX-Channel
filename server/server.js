const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const crypto   = require("crypto");
const Database = require("better-sqlite3");

const app  = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, "cxchannel.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT,
    email         TEXT NOT NULL,
    product       TEXT NOT NULL,
    productDetails TEXT,
    serialNumber  TEXT,
    description   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    operationTeam TEXT,
    serviceTeam   TEXT,
    createdAt     TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    firstName  TEXT NOT NULL,
    lastName   TEXT NOT NULL,
    username   TEXT NOT NULL UNIQUE,
    email      TEXT NOT NULL UNIQUE,
    role       TEXT NOT NULL DEFAULT 'operation',
    password   TEXT NOT NULL,
    createdAt  TEXT NOT NULL
  );
`);

const INVITE_CODE = process.env.INVITE_CODE || "TMI2026";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

function generateShortId() {
  let id, exists = true;
  while (exists) {
    id = "TMI-" + Math.floor(1000 + Math.random() * 9000);
    exists = !!db.prepare("SELECT id FROM requests WHERE id = ?").get(id);
  }
  return id;
}

function generateUserId() {
  return "USR-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

function normalizeStatus(status) {
  const allowed = ["pending", "review", "approved", "rejected"];
  return allowed.includes((status || "").toLowerCase()) ? status.toLowerCase() : "pending";
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "cx_salt_tmI").digest("hex");
}

function indiaTimestamp() {
  return new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "team-login.html"));
});

/* ── AUTH ── */
app.post("/auth/signup", (req, res) => {
  const { firstName, lastName, username, email, role, password, inviteCode } = req.body;
  if (!firstName || !lastName || !username || !email || !role || !password || !inviteCode)
    return res.status(400).json({ error: "All fields are required." });
  if (inviteCode !== INVITE_CODE)
    return res.status(403).json({ error: "Invalid invite code. Contact your manager." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  const cleanUser = username.replace(/\s/g, "").toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE username = ? OR email = ?")
                     .get(cleanUser, email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: "Username or email already registered." });
  try {
    const id = generateUserId();
    db.prepare("INSERT INTO users (id,firstName,lastName,username,email,role,password,createdAt) VALUES (?,?,?,?,?,?,?,?)")
      .run(id, firstName.trim(), lastName.trim(), cleanUser,
           email.trim().toLowerCase(), role, hashPassword(password), indiaTimestamp());
    const user = db.prepare("SELECT id,firstName,lastName,username,email,role,createdAt FROM users WHERE id = ?").get(id);
    res.status(201).json({ message: "Account created successfully.", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required." });
  const cleanUser = username.replace(/\s/g, "").toLowerCase();
  const user = db.prepare("SELECT id,firstName,lastName,username,email,role,createdAt FROM users WHERE username = ? AND password = ?")
                 .get(cleanUser, hashPassword(password));
  if (!user) return res.status(401).json({ error: "Invalid username or password." });
  res.json({ message: "Login successful.", user });
});

/* ── REQUESTS (TEAM) ── */
app.get("/requests", (req, res) => {
  const status = (req.query.status || "").toLowerCase();
  try {
    const rows = (status && ["pending","review","approved","rejected"].includes(status))
      ? db.prepare("SELECT * FROM requests WHERE status = ? ORDER BY rowid DESC").all(status)
      : db.prepare("SELECT * FROM requests ORDER BY rowid DESC").all();
    res.json(rows);
  } catch { res.status(500).json({ error: "Could not fetch requests." }); }
});

app.get("/requests/:id", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Request not found." });
    res.json(row);
  } catch { res.status(500).json({ error: "Could not fetch request." }); }
});

app.post("/requests", (req, res) => {
  const { name, phone, email, product, productDetails, serialNumber,
          description, operationTeam, serviceTeam, status } = req.body;
  if (!name || !email || !product || !description)
    return res.status(400).json({ error: "Name, email, product, and description are required." });
  try {
    const id = generateShortId();
    db.prepare("INSERT INTO requests (id,name,phone,email,product,productDetails,serialNumber,description,status,operationTeam,serviceTeam,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, name.trim(), phone?phone.trim():"", email.trim(), product.trim(),
           productDetails?productDetails.trim():"", serialNumber?serialNumber.trim():"",
           description.trim(), normalizeStatus(status),
           operationTeam?operationTeam.trim():"", serviceTeam?serviceTeam.trim():"",
           indiaTimestamp());
    res.status(201).json(db.prepare("SELECT * FROM requests WHERE id = ?").get(id));
  } catch { res.status(500).json({ error: "Could not create request." }); }
});

app.patch("/requests/:id/status", (req, res) => {
  const status = normalizeStatus(req.body.status);
  try {
    const existing = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Request not found." });
    if (existing.status === "approved" || existing.status === "rejected")
      return res.status(400).json({ error: "Finalized tickets cannot be changed." });
    db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json(db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id));
  } catch { res.status(500).json({ error: "Could not update status." }); }
});

app.patch("/requests/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Request not found." });
  const u = {
    name:           req.body.name           ?? existing.name,
    phone:          req.body.phone          ?? existing.phone,
    email:          req.body.email          ?? existing.email,
    product:        req.body.product        ?? existing.product,
    productDetails: req.body.productDetails ?? existing.productDetails,
    serialNumber:   req.body.serialNumber   ?? existing.serialNumber,
    description:    req.body.description    ?? existing.description,
    status:         normalizeStatus(req.body.status ?? existing.status),
    operationTeam:  req.body.operationTeam  ?? existing.operationTeam,
    serviceTeam:    req.body.serviceTeam    ?? existing.serviceTeam
  };
  try {
    db.prepare("UPDATE requests SET name=?,phone=?,email=?,product=?,productDetails=?,serialNumber=?,description=?,status=?,operationTeam=?,serviceTeam=? WHERE id=?")
      .run(u.name, u.phone, u.email, u.product, u.productDetails, u.serialNumber,
           u.description, u.status, u.operationTeam, u.serviceTeam, req.params.id);
    res.json(db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id));
  } catch { res.status(500).json({ error: "Could not update request." }); }
});

/* ── PUBLIC (CUSTOMER) ── */
app.post("/public/requests", (req, res) => {
  const { name, phone, email, product, productDetails, serialNumber, description } = req.body;
  if (!name || !email || !product || !description)
    return res.status(400).json({ error: "Name, email, product, and description are required." });
  try {
    const id = generateShortId();
    db.prepare("INSERT INTO requests (id,name,phone,email,product,productDetails,serialNumber,description,status,operationTeam,serviceTeam,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, name.trim(), phone?phone.trim():"", email.trim(), product.trim(),
           productDetails?productDetails.trim():"", serialNumber?serialNumber.trim():"",
           description.trim(), "pending", "", "", indiaTimestamp());
    res.status(201).json(db.prepare("SELECT * FROM requests WHERE id = ?").get(id));
  } catch { res.status(500).json({ error: "Could not create public request." }); }
});

app.get("/public/track", (req, res) => {
  const id    = (req.query.id    || "").trim();
  const email = (req.query.email || "").trim();
  if (!id && !email) return res.status(400).json({ error: "Provide an ID or email." });
  try {
    const cols = "id,name,email,product,productDetails,serialNumber,description,status,createdAt";
    const rows = id
      ? db.prepare(`SELECT ${cols} FROM requests WHERE id = ? ORDER BY rowid DESC`).all(id)
      : db.prepare(`SELECT ${cols} FROM requests WHERE email = ? ORDER BY rowid DESC`).all(email);
    res.json(rows);
  } catch { res.status(500).json({ error: "Could not track request." }); }
});

app.listen(PORT, () => {
  console.log(`CX Channel backend running at http://localhost:${PORT}`);
  console.log(`Signup invite code: ${INVITE_CODE}`);
});