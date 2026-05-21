const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, "cxchannel.db"));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

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

function getColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

function hasColumn(tableName, columnName) {
  const columns = getColumns(tableName);
  return columns.some(col => col.name === columnName);
}

function ensureColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
    console.log(`Added missing column: ${tableName}.${columnName}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT '',
    password TEXT DEFAULT '',
    passwordHash TEXT DEFAULT '',
    createdAt TEXT DEFAULT ''
  )
`);

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

ensureColumn("users", "role", "TEXT DEFAULT ''");
ensureColumn("users", "password", "TEXT DEFAULT ''");
ensureColumn("users", "passwordHash", "TEXT DEFAULT ''");
ensureColumn("users", "createdAt", "TEXT DEFAULT ''");

ensureColumn("requests", "forwardTo", "TEXT DEFAULT ''");
ensureColumn("requests", "customerFeedback", "TEXT DEFAULT ''");
ensureColumn("requests", "internalNote", "TEXT DEFAULT ''");

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "team-login.html"));
});

app.post("/auth/signup", (req, res) => {
  const firstName = (req.body.firstName || "").trim();
  const lastName = (req.body.lastName || "").trim();
  const username = (req.body.username || "").trim().toLowerCase();
  const email = (req.body.email || "").trim().toLowerCase();
  const role = (req.body.role || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!firstName || !lastName || !username || !email || !role || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const existing = db
      .prepare("SELECT id FROM users WHERE username = ? OR email = ?")
      .get(username, email);

    if (existing) {
      return res.status(400).json({ error: "Username or email already exists." });
    }

    const createdAt = new Date().toISOString();
    const passwordHashed = hashPassword(password);

    const userColumns = getColumns("users").map(col => col.name);

    if (userColumns.includes("password") && userColumns.includes("passwordHash")) {
      db.prepare(`
        INSERT INTO users (firstName, lastName, username, email, role, password, passwordHash, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        firstName,
        lastName,
        username,
        email,
        role,
        password,
        passwordHashed,
        createdAt
      );
    } else if (userColumns.includes("passwordHash")) {
      db.prepare(`
        INSERT INTO users (firstName, lastName, username, email, role, passwordHash, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        firstName,
        lastName,
        username,
        email,
        role,
        passwordHashed,
        createdAt
      );
    } else if (userColumns.includes("password")) {
      db.prepare(`
        INSERT INTO users (firstName, lastName, username, email, role, password, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        firstName,
        lastName,
        username,
        email,
        role,
        password,
        createdAt
      );
    } else {
      return res.status(500).json({ error: "Users table schema is invalid." });
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully."
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.status(500).json({
      error: err.message || "Could not create account."
    });
  }
});

app.post("/auth/login", (req, res) => {
  const username = (req.body.username || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    const user = db.prepare(`
      SELECT id, firstName, lastName, username, email, role, password, passwordHash
      FROM users
      WHERE username = ?
    `).get(username);

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const hashedInput = hashPassword(password);
    const passwordMatches =
      (user.passwordHash && user.passwordHash === hashedInput) ||
      (user.password && user.password === password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      error: err.message || "Could not login."
    });
  }
});

app.get("/requests", (req, res) => {
  const status = (req.query.status || "").toLowerCase();

  try {
    let rows;
    if (status && ["pending", "review", "approved", "rejected"].includes(status)) {
      rows = db.prepare("SELECT * FROM requests WHERE status = ? ORDER BY rowid DESC").all(status);
    } else {
      rows = db.prepare("SELECT * FROM requests ORDER BY rowid DESC").all();
    }

    res.json(rows);
  } catch (err) {
    console.error("FETCH REQUESTS ERROR:", err);
    res.status(500).json({ error: "Could not fetch requests." });
  }
});

app.get("/requests/:id", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);

    if (!row) {
      return res.status(404).json({ error: "Request not found." });
    }

    const history = db.prepare(`
      SELECT id, product, productDetails, serialNumber, status, createdAt, customerFeedback
      FROM requests
      WHERE email = ?
      ORDER BY rowid DESC
    `).all(row.email);

    res.json({
      ...row,
      customerHistory: history
    });
  } catch (err) {
    console.error("FETCH REQUEST ERROR:", err);
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
    status,
    forwardTo,
    customerFeedback,
    internalNote
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
        description, status, operationTeam, serviceTeam, createdAt,
        forwardTo, customerFeedback, internalNote
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      phone ? phone.trim() : "",
      email.trim().toLowerCase(),
      product.trim(),
      productDetails ? productDetails.trim() : "",
      serialNumber ? serialNumber.trim() : "",
      description.trim(),
      normalizeStatus(status),
      operationTeam ? operationTeam.trim() : "",
      serviceTeam ? serviceTeam.trim() : "",
      createdAt,
      forwardTo ? forwardTo.trim() : "",
      customerFeedback ? customerFeedback.trim() : "",
      internalNote ? internalNote.trim() : ""
    );

    const newRequest = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
    res.status(201).json(newRequest);
  } catch (err) {
    console.error("CREATE REQUEST ERROR:", err);
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
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ error: "Could not update status." });
  }
});

app.patch("/requests/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: "Request not found." });
  }

  if (existing.status === "approved" || existing.status === "rejected") {
    return res.status(400).json({ error: "Finalized tickets cannot be edited." });
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
    serviceTeam: req.body.serviceTeam ?? existing.serviceTeam,
    forwardTo: req.body.forwardTo ?? existing.forwardTo,
    customerFeedback: req.body.customerFeedback ?? existing.customerFeedback,
    internalNote: req.body.internalNote ?? existing.internalNote
  };

  try {
    db.prepare(`
      UPDATE requests
      SET name = ?, phone = ?, email = ?, product = ?, productDetails = ?,
          serialNumber = ?, description = ?, status = ?, operationTeam = ?,
          serviceTeam = ?, forwardTo = ?, customerFeedback = ?, internalNote = ?
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
      updated.forwardTo,
      updated.customerFeedback,
      updated.internalNote,
      req.params.id
    );

    const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);
    res.json(row);
  } catch (err) {
    console.error("UPDATE REQUEST ERROR:", err);
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
        description, status, operationTeam, serviceTeam, createdAt,
        forwardTo, customerFeedback, internalNote
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      phone ? phone.trim() : "",
      email.trim().toLowerCase(),
      product.trim(),
      productDetails ? productDetails.trim() : "",
      serialNumber ? serialNumber.trim() : "",
      description.trim(),
      "pending",
      "",
      "",
      createdAt,
      "",
      "Your request has been received. Our team will review it shortly.",
      ""
    );

    const newRequest = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
    res.status(201).json(newRequest);
  } catch (err) {
    console.error("PUBLIC REQUEST ERROR:", err);
    res.status(500).json({ error: "Could not create public request." });
  }
});

app.listen(PORT, () => {
  console.log(`CX Channel backend running at http://localhost:${PORT}`);
});