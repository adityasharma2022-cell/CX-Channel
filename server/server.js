const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { sendMail, verifyMailer } = require("./mailer");
const prisma = require("./prisma");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, "..");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function generateSubmissionId() {
  return "SUB-" + Date.now() + Math.floor(Math.random() * 1000);
}

async function generateRmaNumber() {
  const maxRow = await prisma.request.aggregate({ _max: { rmaNumber: true } });
  let max = 0;
  const raw = maxRow._max?.rmaNumber || "";
  const digits = raw.replace(/\D/g, "");
  if (digits) max = parseInt(digits, 10);
  if (!Number.isFinite(max)) max = 0;
  return String(max + 1).padStart(5, "0");
}

function parseIST(str) {
  if (!str) return 0;
  const [datePart, timePart] = String(str).split(", ");
  if (!datePart) return 0;
  const [day, month, year] = datePart.split("/").map(Number);
  const [h = 0, m = 0, s = 0] = (timePart || "").split(":").map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day, h, m, s).getTime();
}

function isPendingFlag(value) {
  return String(value || "").trim().length > 0;
}

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

const IP_FIELDS = [
  "ipAdminNote",
  "ipReceivedDate",
  "ipDateOfInvestigation",
  "ipWarranty",
  "ipInvestigationDetails",
  "ipRepairDetails",
  "ipEstimateDate",
  "ipEstimateNumber",
  "ipEstimateAmount",
  "ipPoNoAndDate",
  "ipPoReceivedDate",
  "ipOemRmaNo",
  "ipDateOfSent",
  "ipPlatformModule",
  "ipOemQuotation",
  "ipDateOfReceivingFromOem",
  "ipDcNoAndDate",
  "ipDispatchedDate",
  "ipLrNo",
  "ipReasonForWaiting",
  "ipDeliveredDate",
  "ipAckDateFromWh",
  "ipRemark",
];

function reconstructProcessingDetails(row) {
  const details = {};
  for (const field of IP_FIELDS) {
    details[field] = row[field] || "";
  }
  return details;
}

function formatImages(images) {
  return (images || []).map((img) => ({
    originalName: img.originalName,
    fileName: img.fileName,
    path: img.path,
    mimeType: img.mimeType,
    size: img.size,
  }));
}

function formatRequest(row) {
  const { images, ...rest } = row;
  return {
    ...rest,
    processingDetails: reconstructProcessingDetails(row),
    images: formatImages(images),
  };
}

function formatSupport(row) {
  const { images, ...rest } = row;
  return { ...rest, images: formatImages(images) };
}

const REQUEST_INCLUDE = { images: true };
const SUPPORT_INCLUDE = { images: true };

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

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "Username and password are required." });
    const user = await prisma.user.findFirst({
      where: { username, role: "team" },
    });
    if (!user) return res.status(401).json({ message: "Invalid team credentials." });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid team credentials." });
    res.json({
      message: "Login successful.",
      token: `fake-jwt-${user.id}`,
      username: user.username,
      role: user.role,
      department: user.department || "",
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed." });
  }
});

app.post("/api/auth/customer-login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "Username and password are required." });
    const user = await prisma.user.findFirst({
      where: { username, role: "customer" },
    });
    if (!user)
      return res.status(401).json({ message: "Invalid customer credentials." });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: "Invalid customer credentials." });
    res.json({
      message: "Login successful.",
      token: `fake-jwt-${user.id}`,
      username: user.username,
      role: user.role,
      email: user.email || "",
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed." });
  }
});

app.post("/auth/signup", async (req, res) => {
  try {
    const { firstName, lastName, username, email, role, password } =
      req.body || {};
    if (!firstName || !lastName || !username || !email || !role || !password)
      return res.status(400).json({ error: "All fields are required." });
    if (String(password).length < 8)
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername)
      return res.status(409).json({ error: "Username already exists." });
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail)
      return res.status(409).json({ error: "Email already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        username,
        email,
        role: "team",
        department: role,
        password: hashedPassword,
      },
    });
    res.status(201).json({ message: "Account created successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Signup failed." });
  }
});

app.get("/api/requests", async (req, res) => {
  try {
    const email = req.query.email;
    const where = email ? { email } : {};
    const rows = await prisma.request.findMany({
      where,
      include: REQUEST_INCLUDE,
    });
    const formatted = rows.map(formatRequest);
    res.json(
      formatted.sort((a, b) => {
        const aIssued = parseIST(a.rmaIssuedAt);
        const bIssued = parseIST(b.rmaIssuedAt);
        if (aIssued || bIssued) return bIssued - aIssued;
        return parseIST(b.createdAt) - parseIST(a.createdAt);
      }),
    );
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load requests." });
  }
});

app.get("/api/requests/:id", async (req, res) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: REQUEST_INCLUDE,
    });
    if (!request) return res.status(404).json({ message: "Request not found." });
    const history = await prisma.request.findMany({
      where: { email: request.email, id: { not: request.id } },
      include: REQUEST_INCLUDE,
    });
    const formattedHistory = history
      .map(formatRequest)
      .sort((a, b) => parseIST(b.createdAt) - parseIST(a.createdAt));
    res.json({ request: formatRequest(request), history: formattedHistory });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load request." });
  }
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

    const id = generateSubmissionId();
    const record = await prisma.request.create({
      data: {
        id,
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
        status: "new",
        createdAt: now,
        updatedAt: now,
        images: {
          create: uploadedImages,
        },
      },
      include: REQUEST_INCLUDE,
    });

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
          <p><strong>Location:</strong> ${record.location || "\u2014"}</p>
          ${record.poNumber || record.poDate ? `<p><strong>PO:</strong> ${record.poNumber || "\u2014"} / ${record.poDate || "\u2014"}</p>` : ""}
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

    res.status(201).json({
      message: "Request submitted successfully.",
      id: record.id,
      request: formatRequest(record),
      emails,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Request submit failed." });
  }
});

app.put("/api/requests/:id", async (req, res) => {
  try {
    const existing = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: REQUEST_INCLUDE,
    });
    if (!existing)
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
    ];
    const ipAllowed = ["processingDetails"];

    const body = req.body || {};
    const decision = String(body.approvalDecision || "").toLowerCase();

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

    const updateData = {};
    for (const k of allowed) {
      if (body[k] !== undefined) updateData[k] = body[k];
    }

    if (body.processingDetails && typeof body.processingDetails === "object") {
      for (const field of IP_FIELDS) {
        if (body.processingDetails[field] !== undefined) {
          updateData[field] = body.processingDetails[field];
        }
      }
    }

    let record = { ...existing };

    if (decision === "approved") {
      updateData.approvalStatus = "approved";
      updateData.status = "open";
      updateData.disapprovalReason = "";
    } else if (decision === "disapproved") {
      updateData.approvalStatus = "disapproved";
      updateData.status = "disapproved";
      updateData.disapprovalReason = String(body.disapprovalReason || "").trim();
    } else if (decision === "reset") {
      updateData.approvalStatus = "";
      updateData.disapprovalReason = "";
    }

    const movingToOpen =
      (updateData.status || record.status) === "open" &&
      (!record.rmaNumber || !record.rmaIssuedAt);
    if (movingToOpen) {
      updateData.rmaNumber = await generateRmaNumber();
      updateData.rmaIssuedAt = nowIST();
    }

    updateData.updatedAt = nowIST();

    record = await prisma.request.update({
      where: { id: req.params.id },
      data: updateData,
      include: REQUEST_INCLUDE,
    });

    let customerMail = { sent: false };

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
        await prisma.request.update({
          where: { id: record.id },
          data: { customerMailStatus: "sent" },
        });
        record.customerMailStatus = "sent";
      } catch (mailErr) {
        console.error("Approval mail failed:", mailErr.message);
        customerMail.error = mailErr.message;
        await prisma.request.update({
          where: { id: record.id },
          data: { customerMailStatus: "failed" },
        });
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
        await prisma.request.update({
          where: { id: record.id },
          data: { customerMailStatus: "sent" },
        });
        record.customerMailStatus = "sent";
      } catch (mailErr) {
        console.error("Disapproval mail failed:", mailErr.message);
        customerMail.error = mailErr.message;
        await prisma.request.update({
          where: { id: record.id },
          data: { customerMailStatus: "failed" },
        });
        record.customerMailStatus = "failed";
      }
    }

    res.json({
      message: "Request updated successfully.",
      request: formatRequest(record),
      emails: { customer: customerMail },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Request update failed." });
  }
});

app.delete("/api/requests/:id", async (req, res) => {
  try {
    await prisma.request.delete({ where: { id: req.params.id } });
    res.json({ message: "Request deleted." });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Request not found." });
    }
    res.status(500).json({ message: err.message || "Delete failed." });
  }
});

app.get("/api/export/csv", async (req, res) => {
  try {
    const db = await prisma.request.findMany({ include: REQUEST_INCLUDE });
    const formatted = db.map(formatRequest);
    if (!formatted.length)
      return res.status(404).json({ message: "No data to export." });

    const displayRma = (record) => {
      return record.rmaNumber
        ? String(record.rmaNumber).replace(/^(?:T-|RMA-)/i, "")
        : "\u2014";
    };

    const fmtStatus = (s) => {
      const v = String(s || "").toLowerCase();
      if (!v) return "\u2014";
      return v.charAt(0).toUpperCase() + v.slice(1);
    };

    const baseFields = [
      ["Sr.", (_r, i) => i + 1],
      ["RMA No", (r) => displayRma(r)],
      ["RMA Date", (r) => r.rmaIssuedAt || "-"],
      ["Submission Reference", (r) => r.id || "-"],
      ["Status", (r) => fmtStatus(r.status)],
      [
        "Pending From",
        (r) => {
          if (isPendingFlag(r.pendingForCustomer))
            return "Pending from Customer";
          if (isPendingFlag(r.pendingForFastech))
            return "Pending from Fastech";
          if (isPendingFlag(r.pendingForOem)) return "Pending from OEM";
          return "\u2014";
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
      ["Base Unit S-Number", (r) => r.serialBaseUnit || "-"],
      ["RF Cable Serial Number", (r) => r.serialRfCable || "-"],
      ["Antenna Serial Number", (r) => r.serialAntenna || "-"],
      ["Received Date", (r) => r.processingDetails?.ipReceivedDate || "-"],
      ["Warranty", (r) => r.processingDetails?.ipWarranty || "-"],
      ["Estimate Date", (r) => r.processingDetails?.ipEstimateDate || "-"],
      ["Estimate Number", (r) => r.processingDetails?.ipEstimateNumber || "-"],
      [
        "Estimate Amount (INR)",
        (r) => r.processingDetails?.ipEstimateAmount || "-",
      ],
      [
        "P.O. No. & Date",
        (r) => r.processingDetails?.ipPoNoAndDate || "-",
      ],
      [
        "PO Received Date",
        (r) => r.processingDetails?.ipPoReceivedDate || "-",
      ],
      ["OEM RMA No.", (r) => r.processingDetails?.ipOemRmaNo || "-"],
      ["Date of Sent", (r) => r.processingDetails?.ipDateOfSent || "-"],
      [
        "Platform / Module",
        (r) => r.processingDetails?.ipPlatformModule || "-",
      ],
      [
        "OEM Quotation",
        (r) => r.processingDetails?.ipOemQuotation || "-",
      ],
      [
        "Date of Receiving from OEM",
        (r) => r.processingDetails?.ipDateOfReceivingFromOem || "-",
      ],
      ["DC No. & Date", (r) => r.processingDetails?.ipDcNoAndDate || "-"],
      [
        "Dispatched Date",
        (r) => r.processingDetails?.ipDispatchedDate || "-",
      ],
      ["LR No.", (r) => r.processingDetails?.ipLrNo || "-"],
      [
        "Delivered Date",
        (r) => r.processingDetails?.ipDeliveredDate || "-",
      ],
      [
        "Ack. Date from WH",
        (r) => r.processingDetails?.ipAckDateFromWh || "-",
      ],
      ["Admin Note", (r) => r.processingDetails?.ipAdminNote || "-"],
      [
        "Reason for Waiting",
        (r) => r.processingDetails?.ipReasonForWaiting || "-",
      ],
      ["Remark", (r) => r.processingDetails?.ipRemark || "-"],
      [
        "Date of Investigation",
        (r) => r.processingDetails?.ipDateOfInvestigation || "-",
      ],
      [
        "Investigation Details",
        (r) => r.processingDetails?.ipInvestigationDetails || "-",
      ],
      ["Repair Details", (r) => r.processingDetails?.ipRepairDetails || "-"],
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

    const headers = baseFields.map(([label]) => label);
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const sortedDb = [...formatted].sort((a, b) => {
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
  } catch (err) {
    res.status(500).json({ message: err.message || "Export failed." });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const db = await prisma.request.findMany({
      select: {
        status: true,
        pendingForCustomer: true,
        pendingForFastech: true,
        pendingForOem: true,
      },
    });

    const countStatus = (s) =>
      db.filter((r) => String(r.status || "").toLowerCase() === s).length;

    res.json({
      total: db.length,
      new: countStatus("new"),
      open: countStatus("open"),
      pending: countStatus("pending"),
      pendingFromCustomer: db.filter((r) =>
        isPendingFlag(r.pendingForCustomer),
      ).length,
      pendingFromFastech: db.filter((r) =>
        isPendingFlag(r.pendingForFastech),
      ).length,
      pendingFromOem: db.filter((r) => isPendingFlag(r.pendingForOem)).length,
      disapproved: countStatus("disapproved"),
      closed: countStatus("closed"),
      approved: countStatus("approved"),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Stats failed." });
  }
});

app.get("/api/support", async (req, res) => {
  try {
    const email = req.query.email;
    const where = email ? { email } : {};
    const rows = await prisma.support.findMany({
      where,
      include: SUPPORT_INCLUDE,
    });
    const formatted = rows.map(formatSupport);
    res.json(
      formatted.sort(
        (a, b) => parseIST(b.createdAt) - parseIST(a.createdAt),
      ),
    );
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load support." });
  }
});

app.get("/api/support/stats", async (req, res) => {
  try {
    const support = await prisma.support.findMany({
      select: {
        status: true,
        pendingForCustomer: true,
        pendingForFastech: true,
        pendingForOem: true,
      },
    });
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, "");
    const count = (s) =>
      support.filter((r) => norm(r.status) === s).length;
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
      pendingFromOem: support.filter((r) =>
        isPendingFlag(r.pendingForOem),
      ).length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Support stats failed." });
  }
});

app.get("/api/support/:id", async (req, res) => {
  try {
    const request = await prisma.support.findUnique({
      where: { id: req.params.id },
      include: SUPPORT_INCLUDE,
    });
    if (!request)
      return res.status(404).json({ message: "Support request not found." });
    res.json({ request: formatSupport(request) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load support." });
  }
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

    const id = generateSubmissionId();
    const record = await prisma.support.create({
      data: {
        id,
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
        status: "Open",
        createdAt: now,
        updatedAt: now,
        images: {
          create: uploadedImages,
        },
      },
      include: SUPPORT_INCLUDE,
    });

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
          <p><strong>Phone:</strong> ${record.phone || "\u2014"}</p>
          <p><strong>Company:</strong> ${record.company || "\u2014"}</p>
          <p><strong>OEM:</strong> ${record.oem}</p>
          <p><strong>Product:</strong> ${record.product}</p>
          <p><strong>Software Version:</strong> ${record.softwareVersion || "\u2014"}</p>
          <p><strong>Description:</strong> ${record.description || "\u2014"}</p>
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
      request: formatSupport(record),
      emails,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Support submit failed." });
  }
});

app.put("/api/support/:id", async (req, res) => {
  try {
    const existing = await prisma.support.findUnique({
      where: { id: req.params.id },
      include: SUPPORT_INCLUDE,
    });
    if (!existing)
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

    if (decision && !["ticketclosed", "reset"].includes(decision)) {
      return res.status(400).json({ message: "Invalid approval decision." });
    }

    const updateData = {};
    for (const k of allowed) {
      if (body[k] !== undefined) updateData[k] = body[k];
    }

    if (decision === "ticketclosed") {
      updateData.status = "Closed";
      updateData.approvalStatus = "";
      updateData.disapprovalReason = "";
    } else if (decision === "reset") {
      updateData.approvalStatus = "";
      updateData.disapprovalReason = "";
    }

    updateData.updatedAt = nowIST();

    let record = await prisma.support.update({
      where: { id: req.params.id },
      data: updateData,
      include: SUPPORT_INCLUDE,
    });

    let customerMail = { sent: false };

    if (decision === "ticketclosed" && !record.email) {
      customerMail.error = "Customer email is missing.";
      await prisma.support.update({
        where: { id: record.id },
        data: { customerMailStatus: "failed" },
      });
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
        await prisma.support.update({
          where: { id: record.id },
          data: { customerMailStatus: "sent" },
        });
        record.customerMailStatus = "sent";
      } catch (mailErr) {
        console.error("Support ticket-closed mail failed:", mailErr.message);
        customerMail.error = mailErr.message;
        await prisma.support.update({
          where: { id: record.id },
          data: { customerMailStatus: "failed" },
        });
        record.customerMailStatus = "failed";
      }
    }

    res.json({
      message: "Support request updated successfully.",
      request: formatSupport(record),
      emails: { customer: customerMail },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Support update failed." });
  }
});

app.get("/api/support/export/csv", async (req, res) => {
  try {
    const support = await prisma.support.findMany({
      include: SUPPORT_INCLUDE,
    });
    const formatted = support.map(formatSupport);
    if (!formatted.length)
      return res.status(404).json({ message: "No data to export." });

    const filterStatus = String(req.query.status || "").trim();
    const norm = (v) =>
      String(v || "")
        .toLowerCase()
        .replace(/\s+/g, "");
    const rows =
      filterStatus && norm(filterStatus) !== "all"
        ? formatted.filter((r) => norm(r.status) === norm(filterStatus))
        : formatted;

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
          : key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (c) => c.toUpperCase());
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
  } catch (err) {
    res.status(500).json({ message: err.message || "Support export failed." });
  }
});

app.delete("/api/support/:id", async (req, res) => {
  try {
    await prisma.support.delete({ where: { id: req.params.id } });
    res.json({ message: "Support request deleted." });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Support request not found." });
    }
    res.status(500).json({ message: err.message || "Delete failed." });
  }
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
