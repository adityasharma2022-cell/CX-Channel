const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { sendMail, verifyMailer } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "server", "data");
const DB_FILE = path.join(DATA_DIR, "requests.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, defaultContent, "utf8");
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
ensureFile(DB_FILE, "[]");
ensureFile(
  USERS_FILE,
  JSON.stringify(
    [
      { id: "u1", username: "admin", password: "admin123", role: "team", department: "admin" },
      { id: "u2", username: "service", password: "service123", role: "team", department: "service" },
      { id: "u3", username: "customer1", password: "cust123", role: "customer", email: "customer1@example.com" }
    ],
    null,
    2
  )
);

const readJSON = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
const readDB = () => readJSON(DB_FILE, []);
const writeDB = (data) => writeJSON(DB_FILE, data);
const readUsers = () => readJSON(USERS_FILE, []);

function generateId() {
  return "TMI-" + Date.now() + Math.floor(Math.random() * 1000);
}

function nowIST() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static(ROOT));

function sendPage(name) {
  return (req, res) => res.sendFile(path.join(ROOT, name));
}

app.get("/", sendPage("index.html"));
app.get("/index.html", sendPage("index.html"));
app.get("/customer.html", sendPage("customer.html"));
app.get("/login.html", sendPage("login.html"));
app.get("/signup.html", sendPage("signup.html"));
app.get("/team-signup.html", sendPage("team-signup.html"));

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: "Username and password are required." });
  const user = readUsers().find((u) => u.username === username && u.password === password && u.role === "team");
  if (!user) return res.status(401).json({ message: "Invalid team credentials." });
  res.json({
    message: "Login successful.",
    token: `fake-jwt-${user.id}`,
    username: user.username,
    role: user.role,
    department: user.department || ""
  });
});

app.post("/api/auth/customer-login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: "Username and password are required." });
  const user = readUsers().find((u) => u.username === username && u.password === password && u.role === "customer");
  if (!user) return res.status(401).json({ message: "Invalid customer credentials." });
  res.json({
    message: "Login successful.",
    token: `fake-jwt-${user.id}`,
    username: user.username,
    role: user.role,
    email: user.email || ""
  });
});

app.post("/auth/signup", (req, res) => {
  const { firstName, lastName, username, email, role, password } = req.body || {};
  if (!firstName || !lastName || !username || !email || !role || !password) return res.status(400).json({ error: "All fields are required." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const users = readUsers();
  if (users.some((u) => u.username === username)) return res.status(409).json({ error: "Username already exists." });
  if (users.some((u) => u.email === email)) return res.status(409).json({ error: "Email already exists." });
  const user = { id: `u${Date.now()}`, firstName, lastName, username, email, role: "team", department: role, password, createdAt: nowIST() };
  users.push(user);
  writeJSON(USERS_FILE, users);
  res.status(201).json({ message: "Account created successfully." });
});

app.get("/api/requests", (req, res) => {
  const db = readDB();
  const email = req.query.email;
  const rows = email ? db.filter((r) => r.email === email) : db;
  res.json(rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
});

app.get("/api/requests/:id", (req, res) => {
  const db = readDB();
  const request = db.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found." });
  const history = db.filter((r) => r.email === request.email && r.id !== request.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  res.json({ request, history });
});

app.post("/api/requests", (req, res) => {
  const body = req.body || {};
  const required = ["name", "email", "oem", "serviceType", "product", "description"];
  const missing = required.filter((k) => !body[k]);
  if (missing.length) return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}.` });

  const now = nowIST();
  const record = {
    id: generateId(),
    oem: body.oem || "",
    serviceType: body.serviceType || "",
    product: body.product || "",
    productDetails: body.productDetails || "",
    description: body.description || "",
    name: body.name || "",
    email: body.email || "",
    phone: body.phone || "",
    company: body.company || "",
    designation: body.designation || "",
    department: body.department || "",
    serialNumber: body.serialNumber || "",
    poNumber: body.poNumber || "",
    poDate: body.poDate || "",
    basicUnit: body.basicUnit || "",
    antenna: body.antenna || "",
    probe: body.probe || "",
    rfCable: body.rfCable || "",
    other: body.other || "",
    billingAddress: body.billingAddress || "",
    returnAddress: body.returnAddress || "",
    calAddress: body.calAddress || "",
    additionalInfo: body.additionalInfo || "",
    status: "pending",
    forwardTo: "",
    operationsTeam: "",
    serviceTeam: "",
    customerFeedback: "",
    internalNote: "",
    createdAt: now,
    updatedAt: now
  };

  const db = readDB();
  db.push(record);
  writeDB(db);
  res.status(201).json({ message: "Request submitted successfully.", id: record.id, request: record });
});

app.put("/api/requests/:id", (req, res) => {
  const db = readDB();
  const idx = db.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Request not found." });
  const allowed = ["status", "forwardTo", "operationsTeam", "serviceTeam", "customerFeedback", "internalNote", "product", "productDetails", "oem", "serviceType"];
  const body = req.body || {};
  allowed.forEach((k) => {
    if (body[k] !== undefined) db[idx][k] = body[k];
  });
  db[idx].updatedAt = nowIST();
  writeDB(db);
  res.json({ message: "Request updated successfully.", request: db[idx] });
});

app.delete("/api/requests/:id", (req, res) => {
  const db = readDB();
  const rest = db.filter((r) => r.id !== req.params.id);
  if (rest.length === db.length) return res.status(404).json({ message: "Request not found." });
  writeDB(rest);
  res.json({ message: "Request deleted." });
});

app.get("/api/export/csv", (req, res) => {
  const db = readDB();
  if (!db.length) return res.status(404).json({ message: "No data to export." });
  const cols = ["id","oem","serviceType","product","productDetails","description","name","email","phone","company","designation","department","serialNumber","poNumber","poDate","basicUnit","antenna","probe","rfCable","other","billingAddress","returnAddress","calAddress","additionalInfo","status","forwardTo","operationsTeam","serviceTeam","customerFeedback","internalNote","createdAt","updatedAt"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...db.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\r\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="fascal_requests_${Date.now()}.csv"`);
  res.send(csv);
});

app.get("/api/stats", (req, res) => {
  const db = readDB();
  const count = (s) => db.filter((r) => String(r.status || "").toLowerCase() === s).length;
  res.json({
    total: db.length,
    pending: count("pending"),
    review: count("review") + count("forwarded"),
    approved: count("approved"),
    resolved: count("resolved"),
    closed: count("closed"),
    rejected: count("rejected")
  });
});

app.get("/api/test-smtp", async (req, res) => {
  try {
    await Promise.race([
      verifyMailer(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP verify timeout")), 10000))
    ]);
    res.json({ message: "SMTP verified" });
  } catch (err) {
    res.status(500).json({ message: err.message || "SMTP verify failed" });
  }
});

app.get("/api/test-mail", async (req, res) => {
  try {
    await Promise.race([
      verifyMailer(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP verify timeout")), 10000))
    ]);

    const info = await Promise.race([
      sendMail({
        to: process.env.TEAM_EMAIL || process.env.SMTP_USER,
        subject: "FASCAL test mail",
        text: "Hello, this is a test mail.",
        html: "<p>Hello, this is a test mail.</p>"
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP send timeout")), 10000))
    ]);

    res.json({ message: "Mail sent successfully.", messageId: info.messageId || null });
  } catch (err) {
    res.status(500).json({ message: err.message || "Mail test failed." });
  }
});

app.use((req, res) => res.status(404).json({ message: "Route not found." }));

app.listen(PORT, () => {
  console.log(`FASCAL Server running at http://localhost:${PORT}`);
});