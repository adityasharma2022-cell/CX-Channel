require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SENDER_EMAIL,
    pass: process.env.SENDER_PASSWORD
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true
  }
});

async function verifyMailer() {
  return true;
}

async function sendMail({ to, subject, text, html }) {
  return transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to,
    subject,
    text,
    html: html || text
  });
}

module.exports = { sendMail, verifyMailer };