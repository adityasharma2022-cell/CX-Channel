require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const { sendMail, verifyMailer } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 3001;
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(DATA_DIR, "requests.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath))
    fs.writeFileSync(filePath, defaultContent, "utf8");
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

ensureFile(DB_FILE, "[]");
ensureFile(
  USERS_FILE,
  JSON.stringify(
    [
      {
        id: "u1",
        username: "admin",
        password: "admin123",
        role: "team",
        department: "admin",
      },
      {
        id: "u2",
        username: "service",
        password: "service123",
        role: "team",
        department: "service",
      },
      {
        id: "u3",
        username: "customer1",
        password: "cust123",
        role: "customer",
        email: "customer1@example.com",
      },
    ],
    null,
    2,
  ),
);

const readJSON = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");

const readDB = () => readJSON(DB_FILE, []);
const writeDB = (data) => writeJSON(DB_FILE, data);
const readUsers = () => readJSON(USERS_FILE, []);

function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
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
    hour12: false,
  });
}

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayValue(value) {
  const text = String(value ?? "").trim();
  return text || "Not provided";
}

const REQUEST_FORM_SECTIONS = [
  {
    title: "Request Reference",
    fields: [
      { label: "RMA / TMI Number", key: "id" },
      { label: "Submitted At", key: "createdAt" },
    ],
  },
  {
    title: "Customer Information",
    fields: [
      { label: "Customer Name", key: "name" },
      { label: "E-MAIL", key: "email" },
      { label: "Phone", key: "phone" },
      { label: "Company", key: "company" },
      { label: "Designation", key: "designation" },
    ],
  },
  {
    title: "Service Details",
    fields: [
      { label: "OEM", key: "oem" },
      { label: "Service Type", key: "serviceType" },
      { label: "Product Model", key: "product" },
    ],
  },
  {
    title: "Serial Numbers",
    fields: [
      { label: "Serial Number", key: "serialSingle" },
      { label: "Base Unit Serial Number", key: "serialBaseUnit" },
      { label: "RF Cable Serial Number", key: "serialRfCable" },
      { label: "Antenna Serial Number", key: "serialAntenna" },
    ],
  },
  {
    title: "Addresses",
    fields: [
      { label: "Billing Address", key: "billingAddress" },
      { label: "Return Address", key: "returnAddress" },
      {
        label: "Calibration Certificate Address",
        key: "calCertificateAddress",
      },
    ],
  },
  {
    title: "Issue Details",
    fields: [{ label: "Description of Issue", key: "description" }],
  },
];

function formatAttachmentList(record) {
  if (!record.images?.length) return "None";
  return record.images
    .map((img, i) => `${i + 1}. ${img.originalName || img.fileName || "file"}`)
    .join("\n");
}

function buildFormDetailsText(record) {
  const lines = [];
  for (const section of REQUEST_FORM_SECTIONS) {
    lines.push(section.title.toUpperCase());
    for (const field of section.fields) {
      lines.push(`${field.label}: ${displayValue(record[field.key])}`);
    }
    lines.push("");
  }
  lines.push("UPLOADED FILES");
  lines.push(formatAttachmentList(record));
  return lines.join("\n").trim();
}

function buildFormDetailsHtml(record) {
  const cellLabel =
    'style="padding:8px 12px;border:1px solid #dbe5f0;font-weight:700;background:#f8fafc;width:220px;vertical-align:top"';
  const cellValue =
    'style="padding:8px 12px;border:1px solid #dbe5f0;vertical-align:top"';

  const sections = REQUEST_FORM_SECTIONS.map((section) => {
    const rows = section.fields
      .map(({ label, key }) => {
        const value = displayValue(record[key]);
        return `<tr><td ${cellLabel}>${escHtml(label)}</td><td ${cellValue}>${escHtml(value).replace(/\n/g, "<br>")}</td></tr>`;
      })
      .join("");

    return `
      <h3 style="margin:24px 0 10px;font-size:15px;color:#0f172a;border-bottom:2px solid #0ea5e9;padding-bottom:6px">${escHtml(section.title)}</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:8px">${rows}</table>
    `;
  }).join("");

  const attachmentRows =
    record.images?.length > 0
      ? record.images
          .map(
            (img, i) =>
              `<tr><td ${cellLabel}>File ${i + 1}</td><td ${cellValue}>${escHtml(img.originalName || img.fileName || "attachment")}</td></tr>`,
          )
          .join("")
      : `<tr><td ${cellLabel}>Uploaded Files</td><td ${cellValue}>None</td></tr>`;

  const attachmentsSection = `
    <h3 style="margin:24px 0 10px;font-size:15px;color:#0f172a;border-bottom:2px solid #0ea5e9;padding-bottom:6px">Uploaded Files</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${attachmentRows}</table>
    ${record.images?.length ? `<p style="margin-top:10px;color:#64748b;font-size:13px">${record.images.length} file(s) attached to this email.</p>` : ""}
  `;

  return sections + attachmentsSection;
}

function buildTeamRequestEmail(record) {
  const text = [
    `New FASCAL request ${record.id}`,
    "",
    buildFormDetailsText(record),
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:760px">
      <h2 style="margin:0 0 12px">New FASCAL Service Request</h2>
      <p style="color:#64748b;margin:0 0 8px">A new customer request has been submitted through the portal.</p>
      ${buildFormDetailsHtml(record)}
    </div>
  `;

  return { subject: `New FASCAL request ${record.id}`, text, html };
}

function buildCustomerConfirmationEmail(record) {
  const text = [
    `Hi ${record.name},`,
    "",
    "Your service request has been received successfully.",
    "",
    buildFormDetailsText(record),
    "",
    "Our team will review your request and contact you shortly.",
    "",
    "Thank you,",
    "FASCAL Service Team",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:760px">
      <h2 style="margin:0 0 12px">Request Received</h2>
      <p>Hi ${escHtml(record.name)},</p>
      <p>Your service request has been submitted successfully. Below is a copy of the details you provided.</p>
      ${buildFormDetailsHtml(record)}
      <p style="margin-top:20px;color:#64748b">Our team will review your request and contact you shortly.</p>
    </div>
  `;

  return {
    subject: `FASCAL request received: ${record.id}`,
    text,
    html,
  };
}

async function sendRequestEmails(record, uploadedFiles = []) {
  const teamEmail = process.env.TEAM_EMAIL;
  const emails = {
    team: { sent: false, to: teamEmail || null },
    customer: { sent: false, to: record.email || null },
  };

  const attachments = uploadedFiles.map((file) => ({
    filename: file.originalname,
    path: file.path,
  }));

  if (teamEmail) {
    try {
      const teamMail = buildTeamRequestEmail(record);
      const info = await sendMail({
        to: teamEmail,
        subject: teamMail.subject,
        text: teamMail.text,
        html: teamMail.html,
        replyTo: record.email,
        attachments,
      });
      emails.team.sent = true;
      emails.team.messageId = info.messageId || null;
    } catch (mailErr) {
      console.error("Team mail failed:", mailErr.message);
      emails.team.error = mailErr.message;
    }
  } else {
    emails.team.error = "TEAM_EMAIL is not configured.";
  }

  if (record.email) {
    try {
      const customerMail = buildCustomerConfirmationEmail(record);
      const info = await sendMail({
        to: record.email,
        subject: customerMail.subject,
        text: customerMail.text,
        html: customerMail.html,
      });
      emails.customer.sent = true;
      emails.customer.messageId = info.messageId || null;
    } catch (mailErr) {
      console.error("Customer mail failed:", mailErr.message);
      emails.customer.error = mailErr.message;
    }
  } else {
    emails.customer.error = "Customer email is missing.";
  }

  return emails;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes first
function sendPage(name) {
  return (req, res) => res.sendFile(path.join(ROOT, name));
}

app.get("/", (req, res) => res.redirect("/login.html"));
app.get("/index.html", sendPage("index.html"));
app.get("/customer.html", sendPage("customer.html"));
app.get("/login.html", sendPage("login.html"));
app.get("/signup.html", sendPage("signup.html"));
app.get("/team-signup.html", sendPage("team-signup.html"));

// Static after routes, and disable auto index.html at /
app.use(express.static(ROOT, { index: false }));
app.use("/uploads", express.static(UPLOAD_DIR));

// Auth routes
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res
      .status(400)
      .json({ message: "Username and password are required." });

  const user = readUsers().find(
    (u) =>
      u.username === username && u.password === password && u.role === "team",
  );

  if (!user)
    return res.status(401).json({ message: "Invalid team credentials." });

  res.json({
    message: "Login successful.",
    token: `fake-jwt-${user.id}`,
    username: user.username,
    role: user.role,
    department: user.department || "",
  });
});

app.post("/api/auth/customer-login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res
      .status(400)
      .json({ message: "Username and password are required." });

  const user = readUsers().find(
    (u) =>
      u.username === username &&
      u.password === password &&
      u.role === "customer",
  );

  if (!user)
    return res.status(401).json({ message: "Invalid customer credentials." });

  res.json({
    message: "Login successful.",
    token: `fake-jwt-${user.id}`,
    username: user.username,
    role: user.role,
    email: user.email || "",
  });
});

app.post("/auth/signup", (req, res) => {
  const { firstName, lastName, username, email, role, password } =
    req.body || {};
  if (!firstName || !lastName || !username || !email || !role || !password)
    return res.status(400).json({ error: "All fields are required." });

  if (String(password).length < 8)
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters." });

  const users = readUsers();
  if (users.some((u) => u.username === username))
    return res.status(409).json({ error: "Username already exists." });
  if (users.some((u) => u.email === email))
    return res.status(409).json({ error: "Email already exists." });

  const user = {
    id: `u${Date.now()}`,
    firstName,
    lastName,
    username,
    email,
    role: "team",
    department: role,
    password,
    createdAt: nowIST(),
  };

  users.push(user);
  writeJSON(USERS_FILE, users);
  res.status(201).json({ message: "Account created successfully." });
});

// Requests
app.get("/api/requests", (req, res) => {
  const db = readDB();
  const email = req.query.email;
  const rows = email ? db.filter((r) => r.email === email) : db;
  res.json(
    rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
  );
});

app.get("/api/requests/:id", (req, res) => {
  const db = readDB();
  const request = db.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found." });

  const history = db
    .filter((r) => r.email === request.email && r.id !== request.id)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  res.json({ request, history });
});

app.post("/api/requests", upload.array("images", 10), async (req, res) => {
  try {
    const body = req.body || {};
    const required = [
      "name",
      "email",
      "oem",
      "serviceType",
      "product",
      "description",
    ];
    const missing = required.filter((k) => !body[k]);
    if (missing.length)
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(", ")}.` });

    const now = nowIST();
    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((f) => ({
          originalName: f.originalname,
          fileName: f.filename,
          path: `/uploads/${f.filename}`,
          mimeType: f.mimetype,
          size: f.size,
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
      updatedAt: now,
    };

    const db = readDB();
    db.push(record);
    writeDB(db);

    const emails = await sendRequestEmails(
      record,
      Array.isArray(req.files) ? req.files : [],
    );
    res.status(201).json({
      message: "Request submitted successfully.",
      id: record.id,
      request: record,
      emails,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Request submit failed." });
  }
});

app.put("/api/requests/:id", (req, res) => {
  const db = readDB();
  const idx = db.findIndex((r) => r.id === req.params.id);
  if (idx === -1)
    return res.status(404).json({ message: "Request not found." });

  const allowed = [
    "status",
    "forwardTo",
    "operationsTeam",
    "serviceTeam",
    "customerFeedback",
    "internalNote",
    "product",
    "oem",
    "serviceType",
  ];

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
  if (rest.length === db.length)
    return res.status(404).json({ message: "Request not found." });

  writeDB(rest);
  res.json({ message: "Request deleted." });
});

// Export & stats
app.get("/api/export/csv", (req, res) => {
  const db = readDB();
  if (!db.length)
    return res.status(404).json({ message: "No data to export." });

  const cols = [
    "id",
    "oem",
    "serviceType",
    "product",
    "description",
    "name",
    "email",
    "phone",
    "company",
    "designation",
    "serialSingle",
    "serialBaseUnit",
    "serialRfCable",
    "serialAntenna",
    "billingAddress",
    "returnAddress",
    "calCertificateAddress",
    "status",
    "forwardTo",
    "operationsTeam",
    "serviceTeam",
    "customerFeedback",
    "internalNote",
    "createdAt",
    "updatedAt",
  ];

  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    cols.join(","),
    ...db.map((r) => cols.map((c) => escape(r[c])).join(",")),
  ].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="fascal_requests_${Date.now()}.csv"`,
  );
  res.send(csv);
});

app.get("/api/stats", (req, res) => {
  const db = readDB();
  const count = (s) =>
    db.filter((r) => String(r.status || "").toLowerCase() === s).length;

  res.json({
    total: db.length,
    pending: count("pending"),
    review: count("review") + count("forwarded"),
    approved: count("approved"),
    resolved: count("resolved"),
    closed: count("closed"),
    rejected: count("rejected"),
  });
});

// SMTP test
app.get("/api/test-smtp", async (req, res) => {
  try {
    await Promise.race([
      verifyMailer(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP verify timeout")), 10000),
      ),
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
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP verify timeout")), 10000),
      ),
    ]);

    const info = await Promise.race([
      sendMail({
        to: process.env.TEAM_EMAIL,
        subject: "FASCAL test mail",
        text: "Hello, this is a test mail.",
        html: "<p>Hello, this is a test mail.</p>",
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP send timeout")), 10000),
      ),
    ]);

    res.json({
      message: "Mail sent successfully.",
      messageId: info.messageId || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Mail test failed." });
  }
});

// 404
app.use((req, res) => res.status(404).json({ message: "Route not found." }));

app.listen(PORT, () => {
  console.log(`FASCAL Server running at http://localhost:${PORT}`);
});
