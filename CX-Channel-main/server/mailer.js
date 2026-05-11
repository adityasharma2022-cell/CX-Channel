const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Email to the CX team
async function notifyTeam(request, action) {
  const subjects = {
    submitted: `New Request Received — ${request.id}`,
    approved:  `Request Approved — ${request.id}`,
    rejected:  `Request Rejected — ${request.id}`,
    review:    `Request Under Review — ${request.id}`
  };

  const colors = {
    submitted: '#BA7517',
    approved:  '#1D9E75',
    rejected:  '#A32D2D',
    review:    '#185FA5'
  };

  await resend.emails.send({
    from:    'CX Channel <onboarding@resend.dev>',
    to:      process.env.TEAM_EMAIL,
    subject: subjects[action] || `Request Update — ${request.id}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="margin-bottom: 24px;">
          <span style="background: ${colors[action]}; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            ${action}
          </span>
        </div>

        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1A1714;">${request.subject}</h2>
        <p style="color: #7A7570; font-size: 14px; margin: 0 0 24px;">${request.id}</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #E2DDD6;">
            <td style="padding: 10px 0; color: #7A7570; width: 140px;">Customer</td>
            <td style="padding: 10px 0; font-weight: 500;">${request.name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2DDD6;">
            <td style="padding: 10px 0; color: #7A7570;">Email</td>
            <td style="padding: 10px 0;">${request.email}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2DDD6;">
            <td style="padding: 10px 0; color: #7A7570;">Priority</td>
            <td style="padding: 10px 0;">${request.priority}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #7A7570;">Submitted</td>
            <td style="padding: 10px 0;">${request.date}</td>
          </tr>
        </table>

        ${request.details ? `
          <div style="margin-top: 20px; background: #F5F3EF; border-radius: 8px; padding: 14px 16px; font-size: 14px; color: #1A1714; line-height: 1.6;">
            ${request.details}
          </div>
        ` : ''}

        <p style="margin-top: 32px; font-size: 12px; color: #7A7570;">
          CX Channel · Request Validation System
        </p>
      </div>
    `
  });
}

// Email to the customer
async function notifyCustomer(request, action) {
  const content = {
    submitted: {
      subject: `We received your request — ${request.id}`,
      heading: 'Your request has been received.',
      message: `Hi ${request.name}, thank you for reaching out. Your request has been logged and our team will review it shortly.`,
      color:   '#BA7517'
    },
    approved: {
      subject: `Your request has been approved — ${request.id}`,
      heading: 'Great news — request approved!',
      message: `Hi ${request.name}, your request has been reviewed and approved. Our team will follow up with next steps shortly.`,
      color:   '#1D9E75'
    },
    rejected: {
      subject: `Update on your request — ${request.id}`,
      heading: 'Request could not be approved.',
      message: `Hi ${request.name}, after reviewing your request, we were unable to approve it at this time. Please contact us if you have questions.`,
      color:   '#A32D2D'
    },
    review: {
      subject: `Your request is under review — ${request.id}`,
      heading: 'We are reviewing your request.',
      message: `Hi ${request.name}, your request is currently being reviewed by our team. We will update you as soon as a decision is made.`,
      color:   '#185FA5'
    }
  };

  const c = content[action] || content.submitted;

  await resend.emails.send({
    from:    'CX Channel <onboarding@resend.dev>',
    to:      request.email,
    subject: c.subject,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="border-left: 4px solid ${c.color}; padding-left: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 6px; font-size: 20px; color: #1A1714;">${c.heading}</h2>
          <p style="margin: 0; font-size: 13px; color: #7A7570;">Reference: ${request.id}</p>
        </div>

        <p style="font-size: 15px; line-height: 1.7; color: #1A1714;">${c.message}</p>

        <div style="margin-top: 24px; background: #F5F3EF; border-radius: 8px; padding: 14px 16px; font-size: 13px;">
          <strong>Request:</strong> ${request.subject}<br/>
          <strong>Priority:</strong> ${request.priority}<br/>
          <strong>Submitted:</strong> ${request.date}
        </div>

        <p style="margin-top: 32px; font-size: 12px; color: #7A7570;">
          This is an automated message from CX Channel. Please do not reply to this email.
        </p>
      </div>
    `
  });
}

module.exports = { notifyTeam, notifyCustomer };