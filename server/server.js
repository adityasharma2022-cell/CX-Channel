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
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function generateSubmissionId() {
  return "SUB-" + Date.now() + Math.floor(Math.random() * 1000);
}

function generateRmaNumber(existingNumbers = new Set()) {
  // Sequential 5-digit RMA numbers (00001, 00002, …) with leading zeros.
  // Increment by 1 each time, never reuse a value, and stay future-proof
  // for a real database (the counter is derived from existing numbers).
  let max = 0;
  for (const raw of existingNumbers) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) continue;
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) continue;
    if (n > max) max = n;
  }
  let next = max + 1;
  // Safety: avoid the (effectively impossible) collision case by incrementing
  // until we land on a free number — the existingNumbers set already contains
  // every used RMA, so a brand-new number is always free on the first try.
  while (existingNumbers.has(String(next).padStart(5, "0"))) {
    next += 1;
  }
  return String(next).padStart(5, "0");
}

// ---------------------------------------------------------------------------
// createdAt is stored as a human-readable IST string like
// "24/05/2026, 19:41:42" (DD/MM/YYYY, HH:MM:SS). Plain string sorting
// (localeCompare / < / >) sorts this alphabetically, which is WRONG for
// dates — e.g. "24/05/2026" would sort before "01/06/2026" alphabetically
// even though June comes after May. This helper turns that string into a
// real numeric timestamp (milliseconds) so we can sort dates correctly.
// ---------------------------------------------------------------------------
function parseIST(str) {
  if (!str) return 0;
  const [datePart, timePart] = String(str).split(", ");
  if (!datePart) return 0;
  const [day, month, year] = datePart.split("/").map(Number);
  const [h = 0, m = 0, s = 0] = (timePart || "").split(":").map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day, h, m, s).getTime();
}

// A "Pending From Customer" / "Pending From Fastech" field is really just a
// yes/no flag — it's set to some non-empty text when true, and "" when not.
// Older records saved it as "Pending For Customer" (note: For, not From),
// so instead of matching exact wording we just check the field is non-empty.
// This keeps old and new records both counting correctly.
function isPendingFlag(value) {
  return String(value || "").trim().length > 0;
}

// Canonical dashboard statuses (single source of truth for both UI and backend).
// "new" is the freshly-submitted state; "open / pending / disapproved / closed"
// are the main statuses that an admin can move a request to.
// "Pending from Customer", "Pending from Fastech", and "Pending from OEM" are stored as sub-status
// fields (pendingForCustomer / pendingForFastech) and do not replace the
// primary status.
const VALID_STATUSES = ["new", "open", "pending", "disapproved", "closed"];

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

// Requests are always returned newest-first, sorted by the real date/time
// (see parseIST above), not by plain text comparison.
app.get("/api/requests", (req, res) => {
  const db = readDB();
  const email = req.query.email;
  const rows = email ? db.filter((r) => r.email === email) : db;
  res.json(
    rows.sort((a, b) => {
      // Issued RMAs lead the work queue, newest issue first. Unassigned new
      // requests follow in submission order until an admin selects a status.
      const aIssued = parseIST(a.rmaIssuedAt);
      const bIssued = parseIST(b.rmaIssuedAt);
      if (aIssued || bIssued) return bIssued - aIssued;
      return parseIST(b.createdAt) - parseIST(a.createdAt);
    }),
  );
});

app.get("/api/requests/:id", (req, res) => {
  const db = readDB();
  const request = db.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found." });
  const history = db
    .filter((r) => r.email === request.email && r.id !== request.id)
    .sort((a, b) => parseIST(b.createdAt) - parseIST(a.createdAt));
  res.json({ request, history });
});

app.post("/api/requests", upload.array("images", 10), async (req, res) => {
  try {
    const body = req.body || {};
    const required = ["name", "email", "oem", "serviceType", "product"];
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
      rmaIssuedAt: "",
      pendingForCustomer: "",
      pendingForFastech: "",
      pendingForOem: "",
      customStatus: "",
      approvalStatus: "",
      customerMailStatus: "",
      disapprovalReason: "",
      processingDetails: {},
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
      // A submitted request enters the queue as a brand-new "New Request".
      // Only an admin may place it in Open, Pending, Disapproved, or Closed.
      status: "new",
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

  const allowed = [
    "status",
    "customerFeedback",
    "internalNote",
    "product",
    "oem",
    "serviceType",
    "pendingForCustomer",
    "pendingForFastech",
    "pendingForOem",
    "customStatus",
    "processingDetails",
  ];
  const body = req.body || {};
  const decision = String(body.approvalDecision || "").toLowerCase();

  // Validate the primary status field against the canonical set.
  if (body.status !== undefined) {
    const normalized = String(body.status || "").toLowerCase();
    if (normalized && !VALID_STATUSES.includes(normalized)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}.`,
      });
    }
    body.status = normalized;
  }

  if (decision && !["approved", "disapproved", "reset"].includes(decision)) {
    return res.status(400).json({ message: "Invalid approval decision." });
  }

  allowed.forEach((k) => {
    if (body[k] !== undefined) db[idx][k] = body[k];
  });
  const record = db[idx];
  let customerMail = { sent: false };

  if (decision === "approved") {
    record.approvalStatus = "approved";
    record.status = "open";
    record.disapprovalReason = "";
  } else if (decision === "disapproved") {
    record.approvalStatus = "disapproved";
    record.status = "disapproved";
    record.disapprovalReason = String(body.disapprovalReason || "").trim();
  } else if (decision === "reset") {
    record.approvalStatus = "";
    record.disapprovalReason = "";
  }

  // Whenever a request first transitions into the "open" (work) queue, assign
  // it the next sequential RMA number and stamp the issue time. This keeps
  // the counter monotonic and gives every worked-on request a unique RMA.
  const movingToOpen =
    record.status === "open" && (!record.rmaNumber || !record.rmaIssuedAt);
  if (movingToOpen) {
    record.rmaNumber = generateRmaNumber(
      new Set(db.map((item) => String(item.rmaNumber || ""))),
    );
    record.rmaIssuedAt = nowIST();
  }

  if (decision === "approved" && record.email) {
    const rmaDisplay = record.rmaNumber
      ? String(record.rmaNumber).replace(/^(?:T-|RMA-)/i, "")
      : "";
    try {
      await sendMail({
        to: record.email,
        subject: `Your FASCAL request has been approved — RMA ${rmaDisplay}`,
        text: `Hi ${record.name}, your request has been approved. Your RMA number is ${rmaDisplay}.`,
        html: `<p>Hi ${escapeHtml(record.name)},</p><p>Your request has been approved.</p><p><strong>RMA Number:</strong> ${escapeHtml(rmaDisplay)}</p>`,
      });
      customerMail.sent = true;
      record.customerMailStatus = "sent";
    } catch (mailErr) {
      console.error("Approval mail failed:", mailErr.message);
      customerMail.error = mailErr.message;
      record.customerMailStatus = "failed";
    }
  }

  if (decision === "disapproved" && record.email) {
    const reason = record.disapprovalReason || "No reason was provided.";
    try {
      await sendMail({
        to: record.email,
        subject: "Your FASCAL request has been disapproved",
        text: `Hi ${record.name}, your request has been disapproved. Reason: ${reason}`,
        html: `<p>Hi ${escapeHtml(record.name)},</p><p>Your request has been disapproved.</p><p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`,
      });
      customerMail.sent = true;
      record.customerMailStatus = "sent";
    } catch (mailErr) {
      console.error("Disapproval mail failed:", mailErr.message);
      customerMail.error = mailErr.message;
      record.customerMailStatus = "failed";
    }
  }

  record.updatedAt = nowIST();
  writeDB(db);

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

  const displayRma = (record) => {
    return record.rmaNumber
      ? String(record.rmaNumber).replace(/^(?:T-|RMA-)/i, "")
      : "—";
  };

  const fmtStatus = (s) => {
    const v = String(s || "").toLowerCase();
    if (!v) return "—";
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  // The CSV is intentionally a flat list of columns a human can read in
  // Excel. They mirror the View Request panel field-for-field (with a few
  // legacy aliases collapsed into one) so the export is a faithful snapshot
  // of what an admin sees on screen.
  const baseFields = [
    ["Sr.", (_r, i) => i + 1],
    ["RMA No", (r) => displayRma(r)],
    ["RMA Date", (r) => r.rmaIssuedAt || "-"],
    ["Submission Reference", (r) => r.id || "-"],
    ["Status", (r) => fmtStatus(r.status)],
    [
      "Pending From",
      (r) => {
        if (isPendingFlag(r.pendingForCustomer)) return "Pending from Customer";
        if (isPendingFlag(r.pendingForFastech)) return "Pending from Fastech";
        if (isPendingFlag(r.pendingForOem)) return "Pending from OEM";
        return "—";
      },
    ],
    ["RMA Current Status", (r) => r.customStatus || "-"],
    ["OEM", (r) => r.oem || "-"],
    ["Service Type", (r) => r.serviceType || "-"],
    ["Product Model", (r) => r.product || "-"],
    ["Description of Issue", (r) => r.description || "-"],
    ["Customer Name", (r) => r.name || "-"],
    ["Company", (r) => r.company || "-"],
    ["Phone", (r) => r.phone || "-"],
    ["Email", (r) => r.email || "-"],
    ["Designation", (r) => r.designation || "-"],
    ["Location", (r) => r.location || "-"],
    ["Billing Address", (r) => r.billingAddress || "-"],
    ["Return Address", (r) => r.returnAddress || "-"],
    // Serial Numbers
    ["Base Unit S-Number", (r) => r.serialBaseUnit || "-"],
    ["RF Cable Serial Number", (r) => r.serialRfCable || "-"],
    ["Antenna Serial Number", (r) => r.serialAntenna || "-"],
    // Internal Processing Details
    ["Received Date", (r) => r.processingDetails?.ipReceivedDate || "-"],
    ["Warranty", (r) => r.processingDetails?.ipWarranty || "-"],
    ["Estimate Date", (r) => r.processingDetails?.ipEstimateDate || "-"],
    ["Estimate Number", (r) => r.processingDetails?.ipEstimateNumber || "-"],
    ["Estimate Amount (INR)", (r) => r.processingDetails?.ipEstimateAmount || "-"],
    ["P.O. No. & Date", (r) => r.processingDetails?.ipPoNoAndDate || "-"],
    ["PO Received Date", (r) => r.processingDetails?.ipPoReceivedDate || "-"],
    ["OEM RMA No.", (r) => r.processingDetails?.ipOemRmaNo || "-"],
    ["Date of Sent", (r) => r.processingDetails?.ipDateOfSent || "-"],
    ["Platform / Module", (r) => r.processingDetails?.ipPlatformModule || "-"],
    ["OEM Quotation", (r) => r.processingDetails?.ipOemQuotation || "-"],
    ["Date of Receiving from OEM", (r) => r.processingDetails?.ipDateOfReceivingFromOem || "-"],
    ["DC No. & Date", (r) => r.processingDetails?.ipDcNoAndDate || "-"],
    ["Dispatched Date", (r) => r.processingDetails?.ipDispatchedDate || "-"],
    ["LR No.", (r) => r.processingDetails?.ipLrNo || "-"],
    ["Delivered Date", (r) => r.processingDetails?.ipDeliveredDate || "-"],
    ["Ack. Date from WH", (r) => r.processingDetails?.ipAckDateFromWh || "-"],
    ["Admin Note", (r) => r.processingDetails?.ipAdminNote || "-"],
    ["Reason for Waiting", (r) => r.processingDetails?.ipReasonForWaiting || "-"],
    ["Remark", (r) => r.processingDetails?.ipRemark || "-"],
    // Investigation & Repair
    ["Date of Investigation", (r) => r.processingDetails?.ipDateOfInvestigation || "-"],
    ["Investigation Details", (r) => r.processingDetails?.ipInvestigationDetails || "-"],
    ["Repair Details", (r) => r.processingDetails?.ipRepairDetails || "-"],
    // Uploaded Files
    [
      "Uploaded Files",
      (r) =>
        (r.images || [])
          .map((f) => f.originalName || f.fileName)
          .join("; ") || "-",
    ],
    ["Created At", (r) => r.createdAt || "-"],
    ["Updated At", (r) => r.updatedAt || "-"],
    ["Disapproval Reason", (r) => r.disapprovalReason || "-"],
  ];

  // Headers are derived directly from the field list above so the export can
  // never drift away from the View Request panel.
  const headers = baseFields.map(([label]) => label);

  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  // Export newest-first too, so it matches what's shown on screen.
  const sortedDb = [...db].sort((a, b) => {
    const aIssued = parseIST(a.rmaIssuedAt);
    const bIssued = parseIST(b.rmaIssuedAt);
    if (aIssued || bIssued) return bIssued - aIssued;
    return parseIST(b.createdAt) - parseIST(a.createdAt);
  });

  const rows = sortedDb.map((r, idx) =>
    baseFields
      .map(([, getter]) => getter(r, idx))
      .map(escape)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="fascal_requests_${Date.now()}.csv"`,
  );
  res.send(csv);
});

// Dashboard card counts — single source of truth used by the Main Dashboard.
// "Pending From Customer" / "Pending From Fastech" are treated as simple
// non-empty flags (see isPendingFlag) so both old ("Pending For Customer")
// and new ("Pending From Customer") saved values count correctly.
app.get("/api/stats", (req, res) => {
  const db = readDB();
  const countStatus = (s) =>
    db.filter((r) => String(r.status || "").toLowerCase() === s).length;

  res.json({
    total: db.length,
    new: countStatus("new"),
    open: countStatus("open"),
    pending: countStatus("pending"),
    pendingFromCustomer: db.filter((r) => isPendingFlag(r.pendingForCustomer))
      .length,
    pendingFromFastech: db.filter((r) => isPendingFlag(r.pendingForFastech))
      .length,
    pendingFromOem: db.filter((r) => isPendingFlag(r.pendingForOem)).length,
    disapproved: countStatus("disapproved"),
    closed: countStatus("closed"),
    // Convenience field kept for any future use
    approved: countStatus("approved"),
  });
});

app.get("/api/support", (req, res) => {
  const support = readSupport();
  const email = req.query.email;
  const rows = email ? support.filter((r) => r.email === email) : support;
  res.json(rows.sort((a, b) => parseIST(b.createdAt) - parseIST(a.createdAt)));
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
    closed: count("closed"),
    pendingFromCustomer: support.filter((r) =>
      isPendingFlag(r.pendingForCustomer),
    ).length,
    pendingFromFastech: support.filter((r) =>
      isPendingFlag(r.pendingForFastech),
    ).length,
    pendingFromOem: support.filter((r) => isPendingFlag(r.pendingForOem))
      .length,
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
    const required = ["name", "email", "oem", "product"];
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
      pendingForOem: "",
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
      assignedName: "",
      approvalStatus: "",
      customerMailStatus: "",
      disapprovalReason: "",
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
        subject: `New FASCAL Support Request ${record.id}`,
        text: `New support request from ${record.name} (${record.email}). Priority: ${record.priority}.`,
        html: `
          <h3>New FASCAL Support Request</h3>
          <p><strong>Submission Reference:</strong> ${record.id}</p>
          <p><strong>Priority:</strong> ${record.priority}</p>
          <p><strong>Name:</strong> ${record.name}</p>
          <p><strong>Email:</strong> ${record.email}</p>
          <p><strong>Phone:</strong> ${record.phone || "—"}</p>
          <p><strong>Company:</strong> ${record.company || "—"}</p>
          <p><strong>OEM:</strong> ${record.oem}</p>
          <p><strong>Product:</strong> ${record.product}</p>
          <p><strong>Software Version:</strong> ${record.softwareVersion || "—"}</p>
          <p><strong>Description:</strong> ${record.description || "—"}</p>
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

  const allowed = [
    "status",
    "priority",
    "assignedTeam",
    "assignedName",
    "internalNote",
    "customerFeedback",
    "pendingForCustomer",
    "pendingForFastech",
    "pendingForOem",
  ];
  const body = req.body || {};
  const decision = String(body.approvalDecision || "").toLowerCase();

  if (body.status !== undefined) {
    const allowedStatuses = ["Open", "Closed"];
    if (!allowedStatuses.includes(body.status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}.`,
      });
    }
  }

  // "ticketClosed" replaces the old approval/disapproval email workflow:
  // marking a ticket Closed now also emails the customer a confirmation.
  if (decision && !["ticketclosed", "reset"].includes(decision)) {
    return res.status(400).json({ message: "Invalid approval decision." });
  }

  allowed.forEach((k) => {
    if (body[k] !== undefined) support[idx][k] = body[k];
  });
  const record = support[idx];
  let customerMail = { sent: false };

  if (decision === "ticketclosed") {
    // Mark the support ticket as closed and reset any prior approval note —
    // these no longer apply now that approve/disapprove is gone.
    record.status = "Closed";
    record.approvalStatus = "";
    record.disapprovalReason = "";
  } else if (decision === "reset") {
    record.approvalStatus = "";
    record.disapprovalReason = "";
  }

  if (decision === "ticketclosed" && !record.email) {
    customerMail.error = "Customer email is missing.";
    record.customerMailStatus = "failed";
  } else if (decision === "ticketclosed" && record.email) {
    const ticketRef = record.id || "";
    try {
      await sendMail({
        to: record.email,
        subject: "Your FASCAL support ticket has been closed",
        text: `Hi ${record.name}, your support ticket ${ticketRef} has been successfully resolved and closed. If you need any further help, please reach out to us.`,
        html: `<p>Hi ${escapeHtml(record.name)},</p><p>Your support ticket <strong>${escapeHtml(ticketRef)}</strong> has been successfully resolved and closed.</p><p>If you need any further help, please reach out to us.</p>`,
      });
      customerMail.sent = true;
      record.customerMailStatus = "sent";
    } catch (mailErr) {
      console.error("Support ticket-closed mail failed:", mailErr.message);
      customerMail.error = mailErr.message;
      record.customerMailStatus = "failed";
    }
  }

  record.updatedAt = nowIST();
  writeSupport(support);

  res.json({
    message: "Support request updated successfully.",
    request: record,
    emails: { customer: customerMail },
  });
});

app.get("/api/support/export/csv", (req, res) => {
  const support = readSupport();
  if (!support.length)
    return res.status(404).json({ message: "No data to export." });

  const filterStatus = String(req.query.status || "").trim();
  const norm = (v) =>
    String(v || "")
      .toLowerCase()
      .replace(/\s+/g, "");
  const rows =
    filterStatus && norm(filterStatus) !== "all"
      ? support.filter((r) => norm(r.status) === norm(filterStatus))
      : support;

  if (!rows.length)
    return res.status(404).json({ message: "No data to export." });

  const excluded = new Set(["images"]);
  const viewKeys = [
    "id",
    "name",
    "email",
    "phone",
    "company",
    "designation",
    "oem",
    "product",
    "softwareVersion",
    "serialSingle",
    "serialBaseUnit",
    "serialRfCable",
    "serialAntenna",
    "billingAddress",
    "returnAddress",
    "calCertificateAddress",
    "description",
    "additionalInfo",
    "priority",
    "status",
    "pendingForCustomer",
    "pendingForFastech",
    "pendingForOem",
    "assignedTeam",
    "assignedName",
    "internalNote",
    "customerFeedback",
    "approvalStatus",
    "customerMailStatus",
    "disapprovalReason",
    "createdAt",
    "updatedAt",
  ];
  const keys = [
    ...new Set([...viewKeys, ...rows.flatMap((r) => Object.keys(r))]),
  ].filter((key) => !excluded.has(key));
  const heading = (key) =>
    key === "assignedTeam"
      ? "Assigned To Team"
      : key === "assignedName"
        ? "Assigned Name"
        : key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  const headers = [...keys.map(heading), "Pending From", "Uploaded Files"];

  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const dataRows = rows.map((r) => {
    return [
      ...keys.map((key) => r[key] || "-"),
      isPendingFlag(r.pendingForCustomer)
        ? "Pending from Customer"
        : isPendingFlag(r.pendingForFastech)
          ? "Pending from Fastech"
          : isPendingFlag(r.pendingForOem)
            ? "Pending from OEM"
            : "-",
      (r.images || [])
        .map((file) => file.originalName || file.fileName)
        .join("; ") || "-",
    ];
  });

  const csv = [
    headers.join(","),
    ...dataRows.map((row) => row.map(escape).join(",")),
  ].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="fascal_support_${Date.now()}.csv"`,
  );
  res.send(csv);
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
