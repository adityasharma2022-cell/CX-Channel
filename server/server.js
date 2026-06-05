const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const { sendMail, verifyMailer } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(DATA_DIR, "requests.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, defaultContent, "utf8");
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT));
app.use("/uploads", express.static(UPLOAD_DIR));

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

app.post("/api/requests", upload.array("images", 10), async (req, res) => {
  try {
    const body = req.body || {};
    const required = ["name", "email", "oem", "serviceType", "product", "description"];
    const missing = required.filter((k) => !body[k]);
    if (missing.length) return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}.` });

    const now = nowIST();
    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((f) => ({
          originalName: f.originalname,
          fileName: f.filename,
          path: `/uploads/${f.filename}`,
          mimeType: f.mimetype,
          size: f.size
        }))
      : [];

    const record = {
      id: generateId(),
      oem: body.oem || "",
      serviceType: body.serviceType || "",
      product: body.product || "",
      description: body.description || "",
      name: body.name || "",
      email: body.email || "",
      phone: body.phone || "",
      company: body.company || "",
      designation: body.designation || "",
      serialSingle: body.serialSingle || "",
      serialBaseUnit: body.serialBaseUnit || "",
      serialRfCable: body.serialRfCable || "",
      serialAntenna: body.serialAntenna || "",
      billingAddress: body.billingAddress || "",
      returnAddress: body.returnAddress || "",
      calCertificateAddress: body.calCertificateAddress || "",
      images: uploadedImages,
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

    try {
      await sendMail({
        to: process.env.TEAM_EMAIL,
        subject: `New FASCAL request ${record.id}`,
        text: `New request received from ${record.name} (${record.email}). RMA: ${record.id}`,
        html: `
          <h3>New FASCAL Request</h3>
          <p><strong>RMA:</strong> ${record.id}</p>
          <p><strong>Name:</strong> ${record.name}</p>
          <p><strong>Email:</strong> ${record.email}</p>
          <p><strong>OEM:</strong> ${record.oem}</p>
          <p><strong>Service:</strong> ${record.serviceType}</p>
          <p><strong>Product:</strong> ${record.product}</p>
          <p><strong>Description:</strong> ${record.description}</p>
        `,
        replyTo: record.email
      });
    } catch (mailErr) {
      console.error("Team mail failed:", mailErr.message);
    }

    try {
      await sendMail({
        to: record.email,
        subject: `FASCAL request received: ${record.id}`,
        text: `Hi ${record.name}, your request has been received. RMA number: ${record.id}`,
        html: `<p>Hi ${record.name},</p><p>Your request has been received successfully.</p><p><strong>RMA number:</strong> ${record.id}</p>`
      });
    } catch (mailErr) {
      console.error("Customer mail failed:", mailErr.message);
    }

    res.status(201).json({
      message: "Request submitted successfully.",
      id: record.id,
      request: record
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Request submit failed." });
  }
});

app.put("/api/requests/:id", (req, res) => {
  const db = readDB();
  const idx = db.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Request not found." });
  const allowed = ["status", "forwardTo", "operationsTeam", "serviceTeam", "customerFeedback", "internalNote", "product", "oem", "serviceType"];
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
  const cols = ["id","oem","serviceType","product","description","name","email","phone","company","designation","serialSingle","serialBaseUnit","serialRfCable","serialAntenna","billingAddress","returnAddress","calCertificateAddress","status","forwardTo","operationsTeam","serviceTeam","customerFeedback","internalNote","createdAt","updatedAt"];
  const escape = (v) => `\"${String(v ?? "").replace(/\"/g, '\"\"')}\"`;
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
        to: process.env.TEAM_EMAIL,
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