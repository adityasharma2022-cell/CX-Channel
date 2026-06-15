require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.SMTP_SERVER,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SENDER_EMAIL,
    pass: process.env.SENDER_PASSWORD,
  },
});

async function verifyMailer() {
  return transporter.verify();
}

async function sendMail({ to, subject, text, html, replyTo, attachments }) {
  return transporter.sendMail({
    from: `"FASCAL Service" <${process.env.SENDER_EMAIL}>`,
    to,
    subject,
    text,
    html,
    replyTo,
    attachments,
  });
}

module.exports = { sendMail, verifyMailer };