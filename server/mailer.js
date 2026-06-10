require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: 'fasbom',
    pass: 'InD!@**100'
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
  return transporter.verify();
  print(transporter)
  debugger;
}

async function sendMail({ to, subject, text, html, replyTo, attachments = [] }) {
  return transporter.sendMail({
    from: 'demo@fastech-india.com',
    to : 'demo@fastech-india.com',
    subject,
    text,
    html: html || text,
    replyTo: replyTo || undefined,
    attachments
  });
}

module.exports = { sendMail, verifyMailer };