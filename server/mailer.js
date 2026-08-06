require("dotenv").config({ path: __dirname + "/.env" });
const nodemailer = require("nodemailer");

const SENDER_EMAIL =
  process.env.SENDER_EMAIL ||
  process.env.SNEDER_EMAIL ||
  "undefeatedcrplayer@gmail.com";

const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_HOST = process.env.SMTP_HOST || "smtp.zoho.com";
const SMTP_USER = process.env.SENDER_EMAIL || "";

console.log("[Mailer] Config:", {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  user: SMTP_USER,
  hasPassword: !!process.env.SENDER_PASSWORD,
  ccEmail: process.env.CC_EMAIL || "(none)",
});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: process.env.SENDER_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: false,
  },
  debug: true,
  logger: true,
});

async function verifyMailer() {
  try {
    await transporter.verify();
    console.log("[Mailer] SMTP verification successful");
    return true;
  } catch (err) {
    console.error("[Mailer] SMTP verification failed:", {
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
      command: err.command,
      message: err.message,
    });
    throw err;
  }
}

async function sendMail({
  to,
  subject,
  text,
  html,
  replyTo,
  cc,
  attachments = [],
}) {
  if (!to) {
    throw new Error(
      "Recipient email (to) is required. Set TEAM_EMAIL in server/.env.",
    );
  }

  console.log("[Mailer] Sending mail:", {
    to,
    cc: cc || process.env.CC_EMAIL || "(none)",
    subject,
  });

  try {
    const result = await transporter.sendMail({
      from: `"Admin" <${SENDER_EMAIL}>`,
      to,
      cc: cc || undefined,
      subject,
      text,
      html: html || text,
      replyTo: replyTo || undefined,
      attachments,
    });
    console.log("[Mailer] Mail sent successfully:", result.messageId);
    return result;
  } catch (err) {
    console.error("[Mailer] Send failed:", {
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
      command: err.command,
      message: err.message,
    });
    throw err;
  }
}

module.exports = { sendMail, verifyMailer, SENDER_EMAIL };
