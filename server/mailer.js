require("dotenv").config();
const ZohoMailAPI = require("./zoho-mail-api");

const SENDER_EMAIL =
  process.env.SENDER_EMAIL ||
  process.env.SNEDER_EMAIL ||
  "undefeatedcrplayer@gmail.com";

const zohoApi = new ZohoMailAPI();

console.log("[Mailer] Config:", {
  user: SENDER_EMAIL,
  ccEmail: process.env.CC_EMAIL || "(none)",
  hasZohoCreds: !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_REFRESH_TOKEN),
});

async function verifyMailer() {
  try {
    await zohoApi.verify();
    console.log("[Mailer] Zoho API verification successful");
    return true;
  } catch (err) {
    console.error("[Mailer] Zoho API verification failed:", {
      message: err.message,
      response: err.response?.data,
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
    throw new Error("Recipient email (to) is required.");
  }

  console.log("[Mailer] Sending mail:", {
    to,
    cc: cc || process.env.CC_EMAIL || "(none)",
    subject,
  });

  try {
    const result = await zohoApi.sendMail({
      to,
      subject,
      text,
      html: html || text,
      cc,
      attachments,
    });
    console.log("[Mailer] Mail sent successfully");
    return result;
  } catch (err) {
    console.error("[Mailer] Send failed:", {
      message: err.message,
      response: err.response?.data,
    });
    throw err;
  }
}

module.exports = { sendMail, verifyMailer, SENDER_EMAIL };
