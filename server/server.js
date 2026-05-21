const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = path.join(__dirname, "..");
const DATA_FILE = path.join(__dirname, "requests.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(ROOT_DIR));

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readRequests() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (error) {
    console.error("readRequests error:", error);
    return [];
  }
}

function saveRequests(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("saveRequests error:", error);
    return false;
  }
}

function makeId() {
  return `TMI-${Date.now()}`;
}

function nowLabel() {
  return new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function text(v) {
  return String(v || "").trim();
}

function escapeCsv(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "cx-channel",
    port: PORT,
    dataFile: "server/requests.json",
    time: new Date().toISOString()
  });
});

app.post("/public/request", (req, res) => {
  try {
    const payload = {
      id: makeId(),
      oem: text(req.body.oem),
      serviceType: text(req.body.serviceType),
      product: text(req.body.product || req.body.oem),
      productDetails: text(req.body.productDetails),
      name: text(req.body.name),
      company: text(req.body.company),
      designation: text(req.body.designation),
      department: text(req.body.department),
      phone: text(req.body.phone),
      email: text(req.body.email),
      serialNumber: text(req.body.serialNumber),
      poNumber: text(req.body.poNumber),
      poDate: text(req.body.poDate),
      basicUnit: text(req.body.basicUnit),
      antenna: text(req.body.antenna),
      probe: text(req.body.probe),
      other: text(req.body.other),
      rfCable: text(req.body.rfCable),
      billingAddress: text(req.body.billingAddress),
      returnAddress: text(req.body.returnAddress),
      calibrationAddress: text(req.body.calibrationAddress),
      additionalInfo: text(req.body.additionalInfo),
      description: text(req.body.description),
      status: "pending",
      forwardTo: "",
      operationsTeam: "",
      serviceTeam: "",
      customerFeedback: "",
      internalNote: "",
      createdAt: nowLabel(),
      updatedAt: nowLabel()
    };

    if (!payload.oem || !payload.serviceType || !payload.name || !payload.email || !payload.description) {
      return res.status(400).json({
        message: "OEM, service type, sender name, email, and issue description are required."
      });
    }

    const requests = readRequests();
    requests.push(payload);

    if (!saveRequests(requests)) {
      return res.status(500).json({ message: "Failed to save request." });
    }

    return res.json({
      message: "Request submitted successfully.",
      request: payload
    });
  } catch (error) {
    console.error("POST /public/request error:", error);
    return res.status(500).json({ message: "Failed to submit request." });
  }
});

app.get("/public/track", (req, res) => {
  try {
    const requests = readRequests();
    const email = text(req.query.email).toLowerCase();
    const id = text(req.query.id).toLowerCase();

    let results = requests;

    if (email) {
      results = results.filter(r => String(r.email || "").toLowerCase() === email);
    }

    if (id) {
      results = results.filter(r => String(r.id || "").toLowerCase() === id);
    }

    return res.json(results.slice().reverse());
  } catch (error) {
    console.error("GET /public/track error:", error);
    return res.status(500).json({ message: "Failed to fetch requests." });
  }
});

app.get("/api/requests", (req, res) => {
  try {
    let requests = readRequests().slice().reverse();

    const status = text(req.query.status).toLowerCase();
    const oem = text(req.query.oem).toLowerCase();
    const serviceType = text(req.query.serviceType).toLowerCase();
    const q = text(req.query.q).toLowerCase();

    if (status && status !== "all") {
      requests = requests.filter(r => String(r.status || "").toLowerCase() === status);
    }

    if (oem && oem !== "all") {
      requests = requests.filter(r => String(r.oem || r.product || "").toLowerCase() === oem);
    }

    if (serviceType && serviceType !== "all") {
      requests = requests.filter(r => String(r.serviceType || "").toLowerCase() === serviceType);
    }

    if (q) {
      requests = requests.filter(r =>
        [
          r.id,
          r.oem,
          r.product,
          r.productDetails,
          r.name,
          r.company,
          r.designation,
          r.department,
          r.phone,
          r.email,
          r.serialNumber,
          r.description,
          r.status
        ].join(" ").toLowerCase().includes(q)
      );
    }

    return res.json(requests);
  } catch (error) {
    console.error("GET /api/requests error:", error);
    return res.status(500).json({ message: "Failed to load requests." });
  }
});

app.get("/api/requests/:id", (req, res) => {
  try {
    const requests = readRequests();
    const item = requests.find(r => r.id === req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Request not found." });
    }

    const history = requests
      .filter(r => r.email && item.email && r.email.toLowerCase() === item.email.toLowerCase())
      .slice()
      .reverse();

    return res.json({
      request: item,
      history
    });
  } catch (error) {
    console.error("GET /api/requests/:id error:", error);
    return res.status(500).json({ message: "Failed to fetch request." });
  }
});

app.put("/api/requests/:id", (req, res) => {
  try {
    const requests = readRequests();
    const index = requests.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ message: "Request not found." });
    }

    const current = requests[index];
    const allowedStatuses = ["pending", "review", "forwarded", "approved", "resolved", "closed"];
    const nextStatus = text(req.body.status || current.status).toLowerCase();

    requests[index] = {
      ...current,
      status: allowedStatuses.includes(nextStatus) ? nextStatus : current.status,
      forwardTo: text(req.body.forwardTo ?? current.forwardTo),
      operationsTeam: text(req.body.operationsTeam ?? current.operationsTeam),
      serviceTeam: text(req.body.serviceTeam ?? current.serviceTeam),
      customerFeedback: text(req.body.customerFeedback ?? current.customerFeedback),
      internalNote: text(req.body.internalNote ?? current.internalNote),
      updatedAt: nowLabel()
    };

    if (!saveRequests(requests)) {
      return res.status(500).json({ message: "Failed to update request." });
    }

    return res.json({
      message: "Request updated successfully.",
      request: requests[index]
    });
  } catch (error) {
    console.error("PUT /api/requests/:id error:", error);
    return res.status(500).json({ message: "Failed to update request." });
  }
});

app.get("/api/export/csv", (req, res) => {
  try {
    const requests = readRequests();

    const headers = [
      "Ticket ID",
      "OEM",
      "Service Type",
      "Product",
      "Product Details",
      "Sender Name",
      "Company",
      "Designation",
      "Department",
      "Phone",
      "Email",
      "Serial Number",
      "PO Number",
      "PO Date",
      "Billing Address",
      "Return Address",
      "Calibration Address",
      "Additional Info",
      "Description",
      "Status",
      "Forward To",
      "Operations Team",
      "Service Team",
      "Customer Feedback",
      "Internal Note",
      "Created At",
      "Updated At"
    ];

    const rows = requests.map(r => [
      r.id,
      r.oem,
      r.serviceType,
      r.product,
      r.productDetails,
      r.name,
      r.company,
      r.designation,
      r.department,
      r.phone,
      r.email,
      r.serialNumber,
      r.poNumber,
      r.poDate,
      r.billingAddress,
      r.returnAddress,
      r.calibrationAddress,
      r.additionalInfo,
      r.description,
      r.status,
      r.forwardTo,
      r.operationsTeam,
      r.serviceTeam,
      r.customerFeedback,
      r.internalNote,
      r.createdAt,
      r.updatedAt
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCsv).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="requests-export.csv"');
    return res.send(csv);
  } catch (error) {
    console.error("GET /api/export/csv error:", error);
    return res.status(500).json({ message: "Failed to export CSV." });
  }
});

app.delete("/api/requests/:id", (req, res) => {
  try {
    const requests = readRequests();
    const next = requests.filter(r => r.id !== req.params.id);

    if (next.length === requests.length) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (!saveRequests(next)) {
      return res.status(500).json({ message: "Failed to delete request." });
    }

    return res.json({ message: "Request deleted successfully." });
  } catch (error) {
    console.error("DELETE /api/requests/:id error:", error);
    return res.status(500).json({ message: "Failed to delete request." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/customer.html", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "customer.html"));
});

app.get("*", (req, res) => {
  const requestedPath = path.join(ROOT_DIR, req.path);

  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    return res.sendFile(requestedPath);
  }

  return res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});