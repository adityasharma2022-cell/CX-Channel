const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { sendMail, verifyMailer } = require("./mailer");
const {
  buildSubmissionEmail,
  buildAdminSubmissionEmail,
  buildSupportSubmissionEmail,
  buildApprovalEmail,
  buildDisapprovalEmail,
} = require("./emailTemplates");
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
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const y = ist.getFullYear();
  const M = pad(ist.getMonth() + 1);
  const d = pad(ist.getDate());
  const h = pad(ist.getHours());
  const m = pad(ist.getMinutes());
  const s = pad(ist.getSeconds());
  const r = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${y}${M}${d}${h}${m}${s}-${r}`;
}

async function generateSupportTicketId() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const y = String(ist.getFullYear()).slice(-2);
  const M = pad(ist.getMonth() + 1);
  const d = pad(ist.getDate());
  const h = pad(ist.getHours());
  const m = pad(ist.getMinutes());
  const s = pad(ist.getSeconds());
  const prefix = `${y}${M}${d}${h}${m}${s}`;

  // Counter increments across ALL support tickets (001, 002, 003, …) so every
  // new request follows the previous one in order, not resetting per second.
  const rows = await prisma.support.findMany({
    select: { id: true },
  });
  let maxSeq = 0;
  for (const row of rows) {
    const digits = String(row.id).split("-")[1] || "";
    if (/^\d+$/.test(digits)) maxSeq = Math.max(maxSeq, parseInt(digits, 10));
  }
  const seq = String(Math.min(maxSeq + 1, 999)).padStart(3, "0");
  return `${prefix}-${seq}`;
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

const VALID_STATUSES = ["fresh", "pending", "disapproved", "closed"];

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
  "ipCourierName",
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
    if (!user)
      return res.status(401).json({ message: "Invalid team credentials." });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: "Invalid team credentials." });
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
        const aFresh = String(a.status || "").toLowerCase() === "fresh";
        const bFresh = String(b.status || "").toLowerCase() === "fresh";
        if (aFresh && !bFresh) return -1;
        if (!aFresh && bFresh) return 1;
        const aIssued = parseIST(a.rmaIssuedAt);
        const bIssued = parseIST(b.rmaIssuedAt);
        if (aIssued || bIssued) return bIssued - aIssued;
        return parseIST(b.createdAt) - parseIST(a.createdAt);
      }),
    );
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to load requests." });
  }
});

app.get("/api/requests/:id", async (req, res) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: REQUEST_INCLUDE,
    });
    if (!request)
      return res.status(404).json({ message: "Request not found." });
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
        status: "fresh",
        rmaStatus: "RMA Not Received",
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
      const mail = buildAdminSubmissionEmail(record);
      await sendMail({
        to: teamEmail,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        replyTo: record.email,
      });
      emails.team.sent = true;
    } catch (mailErr) {
      console.error("Team mail failed:", mailErr.message);
      emails.team.error = mailErr.message;
    }

    if (record.email) {
      try {
        const mail = buildSubmissionEmail(record);
        await sendMail({
          to: record.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          replyTo: teamEmail,
        });
        emails.customer.sent = true;
        await prisma.request.update({
          where: { id: record.id },
          data: { customerMailStatus: "sent" },
        });
        record.customerMailStatus = "sent";
      } catch (mailErr) {
        console.error("Submission mail failed:", mailErr.message);
        emails.customer.error = mailErr.message;
        await prisma.request.update({
          where: { id: record.id },
          data: { customerMailStatus: "failed" },
        });
        record.customerMailStatus = "failed";
      }
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
      "rmaStatus",
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
      updateData.status = "pending";
      updateData.disapprovalReason = "";
    } else if (decision === "disapproved") {
      updateData.approvalStatus = "disapproved";
      updateData.status = "disapproved";
      updateData.disapprovalReason = String(
        body.disapprovalReason || "",
      ).trim();
    } else if (decision === "reset") {
      updateData.approvalStatus = "";
      updateData.disapprovalReason = "";
    }

    const movingToPending =
      (updateData.status || record.status) === "pending" &&
      (!record.rmaNumber || !record.rmaIssuedAt);
    if (movingToPending) {
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
      try {
        const mail = buildApprovalEmail(record, {
          senderName: body.senderName,
        });
        await sendMail({
          to: record.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          replyTo: process.env.TEAM_EMAIL,
          attachments: mail.attachments,
          cc: process.env.CC_EMAIL,
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
      try {
        const mail = buildDisapprovalEmail(record, {
          senderName: body.senderName,
        });
        await sendMail({
          to: record.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          replyTo: process.env.TEAM_EMAIL,
          cc: process.env.CC_EMAIL,
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

    const pendingFrom = (r) => {
      if (isPendingFlag(r.pendingForCustomer))
        return "Pending from Customer";
      if (isPendingFlag(r.pendingForFastech)) return "Pending from Fastech";
      if (isPendingFlag(r.pendingForOem)) return "Pending from OEM";
      return "\u2014";
    };

    const baseFields = [
      ["Sr.No", (_r, i) => i + 1],
      ["RMA No", (r) => displayRma(r)],
      ["Date of RMA", (r) => r.rmaIssuedAt || "-"],
      ["OEM", (r) => r.oem || "-"],
      ["Service Type", (r) => r.serviceType || "-"],
      ["Product Model", (r) => r.product || "-"],
      ["Product S/N", (r) => r.serialBaseUnit || "-"],
      ["PO Number", (r) => r.poNumber || "-"],
      ["PO Date", (r) => r.poDate || "-"],
      ["Antenna", (r) => r.serialAntenna || "-"],
      ["RF Cable", (r) => r.serialRfCable || "-"],
      ["Additional Info", (r) => r.additionalInfo || "-"],
      ["Sender's Full Name", (r) => r.name || "-"],
      ["Sender's Contact No", (r) => r.phone || "-"],
      ["Company Name", (r) => r.company || "-"],
      ["Designation of sender", (r) => r.designation || "-"],
      ["Department of sender", (r) => r.location || "-"],
      ["Email ID", (r) => r.email || "-"],
      ["Approved / Disapproved", (r) => fmtStatus(r.status)],
      ["Billing Address", (r) => r.billingAddress || "-"],
      ["Return Address", (r) => r.returnAddress || "-"],
      ["Address for Cal Certificate", (r) => r.calCertificateAddress || "-"],
      ["Description of Issue", (r) => r.description || "-"],
      ["Admin Note", (r) => r.processingDetails?.ipAdminNote || "-"],
      ["Received Date", (r) => r.processingDetails?.ipReceivedDate || "-"],
      [
        "Date of Investigation",
        (r) => r.processingDetails?.ipDateOfInvestigation || "-",
      ],
      ["Warranty", (r) => r.processingDetails?.ipWarranty || "-"],
      [
        "Investigation Details",
        (r) => r.processingDetails?.ipInvestigationDetails || "-",
      ],
      ["Repair Details", (r) => r.processingDetails?.ipRepairDetails || "-"],
      ["Estimate Date", (r) => r.processingDetails?.ipEstimateDate || "-"],
      [
        "Estimate Amount INR",
        (r) => r.processingDetails?.ipEstimateAmount || "-",
      ],
      ["P.O. No. & Date", (r) => r.processingDetails?.ipPoNoAndDate || "-"],
      ["PO Received Date", (r) => r.processingDetails?.ipPoReceivedDate || "-"],
      ["OEM RMA No.", (r) => r.processingDetails?.ipOemRmaNo || "-"],
      ["Date of Sent", (r) => r.processingDetails?.ipDateOfSent || "-"],
      [
        "Platform/ Module",
        (r) => r.processingDetails?.ipPlatformModule || "-",
      ],
      ["OEM Quotation", (r) => r.processingDetails?.ipOemQuotation || "-"],
      [
        "Date of Receving",
        (r) => r.processingDetails?.ipDateOfReceivingFromOem || "-",
      ],
      ["DC No. & Date", (r) => r.processingDetails?.ipDcNoAndDate || "-"],
      ["Dispatched Date", (r) => r.processingDetails?.ipDispatchedDate || "-"],
      ["LR No.", (r) => r.processingDetails?.ipLrNo || "-"],
      ["Open / Closed", (r) => fmtStatus(r.status)],
      ["Open Awaiting for", (r) => pendingFrom(r)],
      ["Reason for waiting", (r) => r.processingDetails?.ipReasonForWaiting || "-"],
      ["Delivered Date", (r) => r.processingDetails?.ipDeliveredDate || "-"],
      ["Ack. Date", (r) => r.processingDetails?.ipAckDateFromWh || "-"],
      ["Submission Reference", (r) => r.id || "-"],
      ["RMA Current Status", (r) => r.customStatus || "-"],
      ["RMA Status", (r) => r.rmaStatus || "RMA Not Received"],
      ["Name of Courier", (r) => r.processingDetails?.ipCourierName || "-"],
      ["Customer Feedback", (r) => r.customerFeedback || "-"],
      ["Estimate Number", (r) => r.processingDetails?.ipEstimateNumber || "-"],
      ["Remark", (r) => r.processingDetails?.ipRemark || "-"],
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
      const aFresh = String(a.status || "").toLowerCase() === "fresh";
      const bFresh = String(b.status || "").toLowerCase() === "fresh";
      if (aFresh && !bFresh) return -1;
      if (!aFresh && bFresh) return 1;
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
        rmaStatus: true,
        pendingForCustomer: true,
        pendingForFastech: true,
        pendingForOem: true,
      },
    });

    const countStatus = (s) =>
      db.filter((r) => String(r.status || "").toLowerCase() === s).length;

    const countRmaStatus = (s) =>
      db.filter((r) => String(r.rmaStatus || "") === s).length;

    res.json({
      total: db.length,
      fresh: countStatus("fresh"),
      pending: countStatus("pending"),
      pendingFromCustomer: db.filter((r) => isPendingFlag(r.pendingForCustomer))
        .length,
      pendingFromFastech: db.filter((r) => isPendingFlag(r.pendingForFastech))
        .length,
      pendingFromOem: db.filter((r) => isPendingFlag(r.pendingForOem)).length,
      disapproved: countStatus("disapproved"),
      closed: countStatus("closed"),
      approved: countStatus("approved"),
      rmaReceived: countRmaStatus("RMA Received"),
      rmaNotReceived: countRmaStatus("RMA Not Received"),
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
      formatted.sort((a, b) => parseIST(b.createdAt) - parseIST(a.createdAt)),
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

    const id = await generateSupportTicketId();
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

    const emails = { team: { sent: false }, customer: { sent: false } };

    if (!process.env.TEAM_EMAIL) {
      console.warn(
        "TEAM_EMAIL is not set — falling back to hardcoded default.",
      );
    }
    const teamEmail = process.env.TEAM_EMAIL;

    try {
      await sendMail({
        to: teamEmail,
        subject: `New Support Request (${record.id})`,
        text: `New support request from ${record.name} (${record.email}). Priority: ${record.priority}.`,
        html: `
          <h3>New Support Request</h3>
          <p><strong>Submission Reference:</strong> ${record.id}</p>
          <p><strong>Priority:</strong> ${record.priority}</p>
          <p><strong>Name:</strong> ${record.name}</p>
          <p><strong>Email:</strong> ${record.email}</p>
          <p><strong>Phone:</strong> ${record.phone || "\u2014"}</p>
          <p><strong>Company:</strong> ${record.company || "\u2014"}</p>
          <p><strong>OEM:</strong> ${record.oem}</p>
          <p><strong>Product:</strong> ${record.product}</p>
          <p><strong>Software Version:</strong> ${record.softwareVersion || "\u2014"}</p>
        `,
        replyTo: record.email,
      });
      emails.team.sent = true;
    } catch (mailErr) {
      console.error("Support team mail failed:", mailErr.message);
      emails.team.error = mailErr.message;
    }

    if (record.email) {
      try {
        const mail = buildSupportSubmissionEmail(record);
        await sendMail({
          to: record.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          replyTo: teamEmail,
        });
        emails.customer.sent = true;
        await prisma.support.update({
          where: { id: record.id },
          data: { customerMailStatus: "sent" },
        });
        record.customerMailStatus = "sent";
      } catch (mailErr) {
        console.error("Support submission mail failed:", mailErr.message);
        emails.customer.error = mailErr.message;
        await prisma.support.update({
          where: { id: record.id },
          data: { customerMailStatus: "failed" },
        });
        record.customerMailStatus = "failed";
      }
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

app.put("/api/support/:id", upload.array("images", 10), async (req, res) => {
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

    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((f) => ({
          originalName: f.originalname,
          fileName: f.filename,
          path: `/uploads/${f.filename}`,
          mimeType: f.mimetype,
          size: f.size,
        }))
      : [];
    if (uploadedImages.length) {
      await prisma.supportImage.createMany({
        data: uploadedImages.map((img) => ({
          supportId: req.params.id,
          ...img,
        })),
      });
      record = await prisma.support.findUnique({
        where: { id: req.params.id },
        include: SUPPORT_INCLUDE,
      });
    }

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
          subject: "Your support ticket has been closed",
          text: `Hi ${record.name}, your support ticket ${ticketRef} has been successfully resolved and closed. If you need any further help, please reach out to us.\n\nService@fastech-india.com\n8693888676`,
          html: `<p>Hi ${escapeHtml(record.name)},</p><p>Your support ticket <strong>${escapeHtml(ticketRef)}</strong> has been successfully resolved and closed.</p><p>If you need any further help, please reach out to us.</p><p>Service@fastech-india.com<br/>8693888676</p>`,
          cc: process.env.CC_EMAIL,
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
      "description",
      "additionalInfo",
      "priority",
      "status",
      "assignedTeam",
      "assignedName",
      "internalNote",
      "customerFeedback",
      "createdAt",
      "updatedAt",
    ];
    const keys = viewKeys.filter((key) => !excluded.has(key));
    const heading = (key) =>
      key === "assignedTeam"
        ? "Assigned To Team"
        : key === "assignedName"
          ? "Assigned to person"
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
