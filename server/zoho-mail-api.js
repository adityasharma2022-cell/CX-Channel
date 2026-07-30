const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

class ZohoMailAPI {
  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.accountId = process.env.ZOHO_ACCOUNT_ID;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const { data } = await axios.post(
      "https://accounts.zoho.in/oauth/v2/token",
      null,
      {
        params: {
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "refresh_token",
        },
      }
    );

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;
    console.log("[ZohoAPI] Token refreshed");
    return this.accessToken;
  }

  async sendMail({ to, subject, text, html, cc, attachments = [] }) {
    const token = await this.getAccessToken();
    const ccAddress = cc || process.env.CC_EMAIL || "";

    console.log("[ZohoAPI] Sending mail:", {
      to,
      cc: ccAddress || "(none)",
      subject,
      attachments: attachments.length,
    });

    const form = new FormData();
    form.append("fromAddress", process.env.SENDER_EMAIL);
    form.append("toAddress", to);
    if (ccAddress) form.append("ccAddress", ccAddress);
    form.append("subject", subject);
    form.append("content", html || text);
    form.append("mailFormat", html ? "HTML" : "PLAIN");

    for (const file of attachments) {
      if (file.path) {
        form.append("attachments", fs.createReadStream(file.path), {
          filename: file.filename || file.name || "attachment",
        });
      }
    }

    const { data } = await axios.post(
      `https://mail.zoho.in/api/accounts/${this.accountId}/messages`,
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders(),
        },
      }
    );

    if (data.status?.code !== 200) {
      throw new Error(data.status?.description || "Zoho API error");
    }

    console.log("[ZohoAPI] Mail sent:", data.data?.messageId);
    return data;
  }

  async verify() {
    const token = await this.getAccessToken();
    const { data } = await axios.get(
      `https://mail.zoho.in/api/accounts/${this.accountId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return data.status?.code === 200;
  }
}

module.exports = ZohoMailAPI;
