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
const SUPPORT_FILE = path.join(DATA_DIR, "support.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath))
    fs.writeFileSync(filePath, defaultContent, "utf8");
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
ensureFile(DB_FILE, "[]");
ensureFile(SUPPORT_FILE, "[]");
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
const readSupport = () => readJSON(SUPPORT_FILE, []);
const writeSupport = (data) => writeJSON(SUPPORT_FILE, data);
const readUsers = () => readJSON(USERS_FILE, []);

function generateSubmissionId() {
  return "SUB-" + Date.now() + Math.floor(Math.random() * 1000);
}

function generateRmaNumber() {
  return "RMA-" + Date.now() + Math.floor(Math.random() * 1000);
}

function isApprovedStatus(status) {
  return String(status || "").toLowerCase() === "approved";
}

function assignRmaOnApproval(record, previousStatus) {
  const nowApproved = isApprovedStatus(record.status);
  const wasApproved = isApprovedStatus(previousStatus);
  if (nowApproved && !wasApproved && !record.rmaNumber) {
    record.rmaNumber = generateRmaNumber();
  }
  if (!nowApproved && wasApproved) {
    record.rmaNumber = "";
  }
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
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

app.get("/", sendPage("landing.html"));
app.get("/landing.html", sendPage("landing.html"));
app.get("/index.html", sendPage("index.html"));
app.get("/customer.html", sendPage("customer.html"));
app.get("/login.html", sendPage("login.html"));
app.get("/signup.html", sendPage("signup.html"));
app.get("/team-signup.html", sendPage("team-signup.html"));

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
      id: generateSubmissionId(),
      rmaNumber: "",
      pendingForCustomer: "",
      pendingForFastech: "",
      oem: body.oem || "",
      serviceType: body.serviceType || "",
      product: body.product || "",
      description: body.description || "",
      name: body.name || "",
      email: body.email || "",
      phone: body.phone || "",
      company: body.company || "",
      designation: body.designation || "",
      location: body.location || "",
      poNumber: body.serviceType === "Calibration" ? body.poNumber || "" : "",
      poDate: body.serviceType === "Calibration" ? body.poDate || "" : "",
      serialSingle: body.serialSingle || "",
      serialBaseUnit: body.serialBaseUnit || "",
      serialRfCable: body.serialRfCable || "",
      serialAntenna: body.serialAntenna || "",
      billingAddress: body.billingAddress || "",
      returnAddress: body.returnAddress || "",
      calCertificateAddress: body.calCertificateAddress || "",
      additionalInfo: body.additionalInfo || "",
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

    const emails = { team: { sent: false }, customer: { sent: false } };

    const teamEmail = process.env.TEAM_EMAIL;
    if (!process.env.TEAM_EMAIL) {
      console.warn(
        "TEAM_EMAIL is not set — falling back to hardcoded default.",
      );
    }

    try {
      await sendMail({
        to: teamEmail,
        subject: `New FASCAL request ${record.id}`,
        text: `New request received from ${record.name} (${record.email}). Submission reference: ${record.id}`,
        html: `
          <h3>New FASCAL Request</h3>
          <p><strong>Submission Reference:</strong> ${record.id}</p>
          <p><strong>Name:</strong> ${record.name}</p>
          <p><strong>Email:</strong> ${record.email}</p>
          <p><strong>OEM:</strong> ${record.oem}</p>
          <p><strong>Service:</strong> ${record.serviceType}</p>
          <p><strong>Product:</strong> ${record.product}</p>
          <p><strong>Location:</strong> ${record.location || "—"}</p>
          ${record.poNumber || record.poDate ? `<p><strong>PO:</strong> ${record.poNumber || "—"} / ${record.poDate || "—"}</p>` : ""}
          <p><strong>Description:</strong> ${record.description}</p>
          <p><em>RMA number will be assigned after admin approval.</em></p>
        `,
        replyTo: record.email,
      });
      emails.team.sent = true;
    } catch (mailErr) {
      console.error("Team mail failed:", mailErr.message);
      emails.team.error = mailErr.message;
    }

    // Customer is notified by email only after admin approval (RMA assigned then).
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

app.put("/api/requests/:id", async (req, res) => {
  const db = readDB();
  const idx = db.findIndex((r) => r.id === req.params.id);
  if (idx === -1)
    return res.status(404).json({ message: "Request not found." });

  const previousStatus = db[idx].status;
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
    "pendingForCustomer",
    "pendingForFastech",
  ];
  const body = req.body || {};
  allowed.forEach((k) => {
    if (body[k] !== undefined) db[idx][k] = body[k];
  });
  if (body.forwardTo !== undefined && String(body.forwardTo || "").trim()) {
    if (!body.status || body.status === "pending") {
      db[idx].status = "forwarded";
    }
  }
  assignRmaOnApproval(db[idx], previousStatus);
  db[idx].updatedAt = nowIST();
  writeDB(db);

  const record = db[idx];
  const statusChanged =
    body.status !== undefined && body.status !== previousStatus;
  let customerMail = { sent: false };

  if (
    statusChanged &&
    record.email &&
    (record.status === "approved" || record.status === "rejected")
  ) {
    const isApproved = record.status === "approved";
    const rmaRef = record.rmaNumber || record.id;
    const subject = isApproved
      ? `Your FASCAL request has been approved — RMA ${rmaRef}`
      : `Your FASCAL request ${record.id} has been rejected`;
    const introLine = isApproved
      ? `Good news — your request has been approved. Your RMA number is ${rmaRef}.`
      : `Your request (reference: ${record.id}) has been rejected.`;

    try {
      await sendMail({
        to: record.email,
        subject,
        text: `Hi ${record.name}, ${introLine}`,
        html: `
          <p>Hi ${record.name},</p>
          <p>${introLine}</p>
          ${isApproved ? `<p><strong>RMA Number:</strong> ${rmaRef}</p>` : ""}
        `,
      });
      customerMail.sent = true;
    } catch (mailErr) {
      console.error("Approval/rejection mail failed:", mailErr.message);
      customerMail.error = mailErr.message;
    }
  }

  res.json({
    message: "Request updated successfully.",
    request: record,
    emails: { customer: customerMail },
  });
});

app.delete("/api/requests/:id", (req, res) => {
  const db = readDB();
  const rest = db.filter((r) => r.id !== req.params.id);
  if (rest.length === db.length)
    return res.status(404).json({ message: "Request not found." });
  writeDB(rest);
  res.json({ message: "Request deleted." });
});

app.get("/api/export/csv", (req, res) => {
  const db = readDB();
  if (!db.length)
    return res.status(404).json({ message: "No data to export." });

  const shortId = (id) => {
    const s = String(id || '');
    const clean = s.replace(/^(TMI-|SUB-|RMA-)/, '');
    return 'T-' + clean.slice(-6).toUpperCase();
  };

  const displayRma = (record) => {
    if (record.rmaNumber) return shortId(record.rmaNumber);
    const s = String(record.status || '').toLowerCase();
    if (['approved', 'closed'].includes(s) && /^TMI-/.test(String(record.id || ''))) {
      return shortId(record.id);
    }
    return '—';
  };

  const fmtStatus = (s) => {
    const v = String(s || 'pending').toLowerCase();
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  const headers = [
    "Sr.",
    "RMA No",
    "OEM",
    "Service Type",
    "Product Model",
    "Customer Name",
    "Company",
    "Designation",
    "Status",
    "Pending From",
    "Date"
  ];

  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = db.map((r, idx) => {
    let pendingForVal = '—';
    const pcNorm = String(r.pendingForCustomer || '').toLowerCase().replace(/\s+/g, '');
    const pfNorm = String(r.pendingForFastech || '').toLowerCase().replace(/\s+/g, '');
    if (pcNorm === 'pendingforcustomer' || pcNorm === 'pendingfromcustomer') {
      pendingForVal = 'Pending from Customer';
    } else if (pfNorm === 'pendingforfastech' || pfNorm === 'pendingfromfastech') {
      pendingForVal = 'Pending from Fastech';
    }

    return [
      idx + 1,
      displayRma(r),
      r.oem || "-",
      r.serviceType || "-",
      r.product || "-",
      r.name || "-",
      r.company || "-",
      r.designation || "-",
      fmtStatus(r.status),
      pendingForVal,
      r.createdAt || "-"
    ].map(escape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="fascal_requests_${Date.now()}.csv"`
  );
  res.send(csv);
});

app.get("/api/stats", (req, res) => {
  const db = readDB();
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\s+/g, "");
  const countPendingFor = (field, label) =>
    db.filter((r) => norm(r[field]) === norm(label)).length;
  const countStatus = (s) =>
    db.filter((r) => String(r.status || "").toLowerCase() === s).length;
  res.json({
    total: db.length,
    pendingFromCustomer: countPendingFor(
      "pendingFromCustomer",
      "Pending From Customer",
    ),
    pendingFromFastech: countPendingFor(
      "pendingFromFastech",
      "Pending From Fastech",
    ),
    forwarded: countStatus("forwarded"),
    finalised: db.filter((r) =>
      ["approved", "closed", "rejected"].includes(
        String(r.status || "").toLowerCase(),
      ),
    ).length,
    // Legacy fields kept for compatibility
    pending: countStatus("pending"),
    review: countStatus("review") + countStatus("forwarded"),
    approved: countStatus("approved"),
    resolved: countStatus("resolved"),
    closed: countStatus("closed"),
    rejected: countStatus("rejected"),
  });
});

app.get("/api/support", (req, res) => {
  const support = readSupport();
  const email = req.query.email;
  const rows = email ? support.filter((r) => r.email === email) : support;
  res.json(
    rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
  );
});

app.get("/api/support/stats", (req, res) => {
  const support = readSupport();
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\s+/g, "");
  const count = (s) => support.filter((r) => norm(r.status) === s).length;
  res.json({
    total: support.length,
    open: count("open"),
    inProgress: count("inprogress"),
    approved: count("approved"),
    rejected: count("rejected"),
    closed: count("closed"),
  });
});

app.get("/api/support/:id", (req, res) => {
  const support = readSupport();
  const request = support.find((r) => r.id === req.params.id);
  if (!request)
    return res.status(404).json({ message: "Support request not found." });
  res.json({ request });
});

app.post("/api/support", upload.array("images", 10), async (req, res) => {
  try {
    const body = req.body || {};
    const required = [
      "name",
      "email",
      "oem",
      "product",
      "description",
      "subject",
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
      id: generateSubmissionId(),
      rmaNumber: "",
      pendingForCustomer: "",
      pendingForFastech: "",
      subject: body.subject || "",
      priority: body.priority || "Medium",
      oem: body.oem || "",
      serviceType: "Support",
      product: body.product || "",
      description: body.description || "",
      name: body.name || "",
      email: body.email || "",
      phone: body.phone || "",
      company: body.company || "",
      designation: body.designation || "",
      softwareVersion: body.softwareVersion || "",
      serialSingle: body.serialSingle || "",
      serialBaseUnit: body.serialBaseUnit || "",
      serialRfCable: body.serialRfCable || "",
      serialAntenna: body.serialAntenna || "",
      billingAddress: body.billingAddress || "",
      returnAddress: body.returnAddress || "",
      calCertificateAddress: body.calCertificateAddress || "",
      additionalInfo: body.additionalInfo || "",
      images: uploadedImages,
      status: "Open",
      assignedTeam: "",
      internalNote: "",
      customerFeedback: "",
      createdAt: now,
      updatedAt: now,
    };

    const support = readSupport();
    support.push(record);
    writeSupport(support);

    const emails = { team: { sent: false } };

    if (!process.env.TEAM_EMAIL) {
      console.warn(
        "TEAM_EMAIL is not set — falling back to hardcoded default.",
      );
    }
    const teamEmail = process.env.TEAM_EMAIL;

    try {
      await sendMail({
        to: teamEmail,
        subject: `New FASCAL Support Request ${record.id}: ${record.subject}`,
        text: `New support request from ${record.name} (${record.email}). Subject: ${record.subject}. Priority: ${record.priority}.`,
        html: `
          <h3>New FASCAL Support Request</h3>
          <p><strong>Submission Reference:</strong> ${record.id}</p>
          <p><strong>Subject:</strong> ${record.subject}</p>
          <p><strong>Priority:</strong> ${record.priority}</p>
          <p><strong>Name:</strong> ${record.name}</p>
          <p><strong>Email:</strong> ${record.email}</p>
          <p><strong>Phone:</strong> ${record.phone || "—"}</p>
          <p><strong>Company:</strong> ${record.company || "—"}</p>
          <p><strong>OEM:</strong> ${record.oem}</p>
          <p><strong>Product:</strong> ${record.product}</p>
          <p><strong>Software Version:</strong> ${record.softwareVersion || "—"}</p>
          <p><strong>Description:</strong> ${record.description}</p>
          <p><em>RMA number will be assigned after admin approval.</em></p>
        `,
        replyTo: record.email,
      });
      emails.team.sent = true;
    } catch (mailErr) {
      console.error("Support team mail failed:", mailErr.message);
      emails.team.error = mailErr.message;
    }

    res.status(201).json({
      message: "Support request submitted successfully.",
      id: record.id,
      request: record,
      emails,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Support submit failed." });
  }
});

app.put("/api/support/:id", async (req, res) => {
  const support = readSupport();
  const idx = support.findIndex((r) => r.id === req.params.id);
  if (idx === -1)
    return res.status(404).json({ message: "Support request not found." });

  const previousStatus = support[idx].status;
  const allowed = [
    "status",
    "priority",
    "assignedTeam",
    "internalNote",
    "customerFeedback",
    "subject",
    "pendingForCustomer",
    "pendingForFastech",
  ];
  const body = req.body || {};
  allowed.forEach((k) => {
    if (body[k] !== undefined) support[idx][k] = body[k];
  });
  assignRmaOnApproval(support[idx], previousStatus);
  support[idx].updatedAt = nowIST();
  writeSupport(support);

  const record = support[idx];
  const statusChanged =
    body.status !== undefined && body.status !== previousStatus;
  let customerMail = { sent: false };

  if (
    statusChanged &&
    record.email &&
    (record.status === "Approved" || record.status === "Rejected")
  ) {
    const isApproved = record.status === "Approved";
    const rmaRef = record.rmaNumber || record.id;
    const subject = isApproved
      ? `Your FASCAL support request has been approved — RMA ${rmaRef}`
      : `Your FASCAL support request ${record.id} has been rejected`;
    const introLine = isApproved
      ? `Good news — your support request has been approved. Your RMA number is ${rmaRef}.`
      : `Your support request (reference: ${record.id}) has been rejected.`;

    try {
      await sendMail({
        to: record.email,
        subject,
        text: `Hi ${record.name}, ${introLine}`,
        html: `
          <p>Hi ${record.name},</p>
          <p>${introLine}</p>
          ${isApproved ? `<p><strong>RMA Number:</strong> ${rmaRef}</p>` : ""}
        `,
      });
      customerMail.sent = true;
    } catch (mailErr) {
      console.error("Support approval/rejection mail failed:", mailErr.message);
      customerMail.error = mailErr.message;
    }
  }

  res.json({
    message: "Support request updated successfully.",
    request: record,
    emails: { customer: customerMail },
  });
});

app.delete("/api/support/:id", (req, res) => {
  const support = readSupport();
  const rest = support.filter((r) => r.id !== req.params.id);
  if (rest.length === support.length)
    return res.status(404).json({ message: "Support request not found." });
  writeSupport(rest);
  res.json({ message: "Support request deleted." });
});

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

app.use((req, res) => res.status(404).json({ message: "Route not found." }));

app.listen(PORT, () => {
  console.log(`FASCAL Server running at http://localhost:${PORT}`);
});
