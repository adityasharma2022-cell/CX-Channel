const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, "cxchannel.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT NOT NULL,
    product TEXT NOT NULL,
    productDetails TEXT,
    serialNumber TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    operationTeam TEXT,
    serviceTeam TEXT,
    createdAt TEXT NOT NULL
  )
`);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "..")));

function generateShortId() {
  let id;
  let exists = true;

  while (exists) {
    id = "TMI-" + Math.floor(1000 + Math.random() * 9000);
    const row = db.prepare("SELECT id FROM requests WHERE id = ?").get(id);
    exists = !!row;
  }

  return id;
}

function normalizeStatus(status) {
  const allowed = ["pending", "review", "approved", "rejected"];
  return allowed.includes((status || "").toLowerCase()) ? status.toLowerCase() : "pending";
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.get("/requests", (req, res) => {
  const status = (req.query.status || "").toLowerCase();

  try {
    let rows;
    if (status && ["pending", "review", "approved", "rejected"].includes(status)) {
      rows = db
        .prepare("SELECT * FROM requests WHERE status = ? ORDER BY rowid DESC")
        .all(status);
    } else {
      rows = db
        .prepare("SELECT * FROM requests ORDER BY rowid DESC")
        .all();
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch requests." });
  }
});

app.get("/requests/:id", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);

    if (!row) {
      return res.status(404).json({ error: "Request not found." });
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch request." });
  }
});

app.post("/requests", (req, res) => {
  const {
    name,
    phone,
    email,
    product,
    productDetails,
    serialNumber,
    description,
    operationTeam,
    serviceTeam,
    status
  } = req.body;

  if (!name || !email || !product || !description) {
    return res.status(400).json({
      error: "Name, email, product, and description are required."
    });
  }

  try {
    const id = generateShortId();
    const createdAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    db.prepare(`
      INSERT INTO requests (
        id, name, phone, email, product, productDetails, serialNumber,
        description, status, operationTeam, serviceTeam, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      phone ? phone.trim() : "",
      email.trim(),
      product.trim(),
      productDetails ? productDetails.trim() : "",
      serialNumber ? serialNumber.trim() : "",
      description.trim(),
      normalizeStatus(status),
      operationTeam ? operationTeam.trim() : "",
      serviceTeam ? serviceTeam.trim() : "",
      createdAt
    );

    const newRequest = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ error: "Could not create request." });
  }
});

app.patch("/requests/:id/status", (req, res) => {
  const status = normalizeStatus(req.body.status);

  try {
    const existing = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: "Request not found." });
    }

    if (existing.status === "approved" || existing.status === "rejected") {
      return res.status(400).json({ error: "Finalized tickets cannot be changed." });
    }

    db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(status, req.params.id);

    const updated = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not update status." });
  }
});

app.patch("/requests/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: "Request not found." });
  }

  const updated = {
    name: req.body.name ?? existing.name,
    phone: req.body.phone ?? existing.phone,
    email: req.body.email ?? existing.email,
    product: req.body.product ?? existing.product,
    productDetails: req.body.productDetails ?? existing.productDetails,
    serialNumber: req.body.serialNumber ?? existing.serialNumber,
    description: req.body.description ?? existing.description,
    status: normalizeStatus(req.body.status ?? existing.status),
    operationTeam: req.body.operationTeam ?? existing.operationTeam,
    serviceTeam: req.body.serviceTeam ?? existing.serviceTeam
  };

  try {
    db.prepare(`
      UPDATE requests
      SET name = ?, phone = ?, email = ?, product = ?, productDetails = ?,
          serialNumber = ?, description = ?, status = ?, operationTeam = ?, serviceTeam = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.phone,
      updated.email,
      updated.product,
      updated.productDetails,
      updated.serialNumber,
      updated.description,
      updated.status,
      updated.operationTeam,
      updated.serviceTeam,
      req.params.id
    );

    const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Could not update request." });
  }
});

app.post("/public/requests", (req, res) => {
  const {
    name,
    phone,
    email,
    product,
    productDetails,
    serialNumber,
    description
  } = req.body;

  if (!name || !email || !product || !description) {
    return res.status(400).json({
      error: "Name, email, product, and description are required."
    });
  }

  try {
    const id = generateShortId();
    const createdAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    db.prepare(`
      INSERT INTO requests (
        id, name, phone, email, product, productDetails, serialNumber,
        description, status, operationTeam, serviceTeam, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      phone ? phone.trim() : "",
      email.trim(),
      product.trim(),
      productDetails ? productDetails.trim() : "",
      serialNumber ? serialNumber.trim() : "",
      description.trim(),
      "pending",
      "",
      "",
      createdAt
    );

    const newRequest = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ error: "Could not create public request." });
  }
});

app.get("/public/track", (req, res) => {
  const id = (req.query.id || "").trim();
  const email = (req.query.email || "").trim();

  if (!id && !email) {
    return res.status(400).json({ error: "Provide an ID or email." });
  }

  try {
    let rows = [];

    if (id) {
      rows = db.prepare(`
        SELECT id, name, email, product, productDetails, serialNumber, description, status, createdAt
        FROM requests
        WHERE id = ?
        ORDER BY rowid DESC
      `).all(id);
    } else {
      rows = db.prepare(`
        SELECT id, name, email, product, productDetails, serialNumber, description, status, createdAt
        FROM requests
        WHERE email = ?
        ORDER BY rowid DESC
      `).all(email);
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not track request." });
  }
});

app.listen(PORT, () => {
  console.log(`CX Channel backend running at http://localhost:${PORT}`);
});