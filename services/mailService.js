const brand = {
  orange: '#FF7D00',
  ink: '#1a1208',
  muted: '#6f6256',
  line: '#eadfd3',
  bg: '#fff8f0',
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function fullName(application) {
  return [application.firstName, application.middleName, application.lastName]
    .filter(Boolean)
    .join(' ')
}

function applicantTypeLabel(type) {
  return type === 'intern' ? 'Internship' : 'Full-time'
}

function formatDateTime(date) {
  return new Date(date || Date.now()).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function messageId(record, category) {
  return `<${category}-${record._id || Date.now()}@plrobotics.in>`
}

function fromAddress(name) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@plrobotics.in'
  return `${name} <${fromEmail}>`
}

async function sendEmail({ fromName, to, replyTo, subject, html, text, messageId: emailMessageId }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Resend email skipped: RESEND_API_KEY env value is missing.')
    return { skipped: true }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(fromName),
      to,
      reply_to: replyTo,
      subject,
      html,
      text,
      headers: emailMessageId ? { 'Message-ID': emailMessageId } : undefined,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.message || data.error || `Resend API error ${response.status}`
    throw new Error(`${message} | status=${response.status} | to=${to} | from=${fromAddress(fromName)}`)
  }

  console.log(`Resend email sent: ${data.id} -> ${Array.isArray(to) ? to.join(', ') : to}`)
  return { skipped: false, id: data.id }
}

function detailRow(label, value) {
  const display = value || 'Not provided'
  return `
    <tr>
      <td style="padding:10px 0;color:${brand.muted};font-size:13px;width:180px;border-bottom:1px solid ${brand.line};">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:${brand.ink};font-size:14px;font-weight:600;border-bottom:1px solid ${brand.line};">${escapeHtml(display)}</td>
    </tr>
  `
}

function interviewInstructionsAndGuidelines() {
  return `
    <div style="margin-top:28px;padding-top:28px;border-top:2px solid ${brand.line};">
      <h2 style="margin:0 0 18px;color:${brand.ink};font-size:18px;font-weight:800;line-height:1.3;">Important Instructions</h2>
      <ul style="margin:0 0 24px;padding-left:24px;color:${brand.ink};font-size:14px;line-height:1.8;">
        <li style="margin-bottom:12px;">Please join the meeting 10-15 minutes before the scheduled time.</li>
        <li style="margin-bottom:12px;">The total duration of the interview process is 2 hours; please be available for the full duration.</li>
        <li style="margin-bottom:12px;">After joining the meeting, please remain in the waiting room until the host admits you for the interview.</li>
        <li style="margin-bottom:12px;">Ensure your camera remains switched ON during the entire interview.</li>
        <li style="margin-bottom:12px;">Please ensure a stable internet connection to avoid any disruptions.</li>
        <li style="margin-bottom:12px;">It is recommended to be seated in a quiet and well-lit environment.</li>
        <li style="margin-bottom:0;">Please note that this interview schedule is final and will not be rescheduled.</li>
      </ul>

      <h2 style="margin:28px 0 18px;color:${brand.ink};font-size:18px;font-weight:800;line-height:1.3;">Preparation Guidelines</h2>
      <ul style="margin:0 0 0;padding-left:24px;color:${brand.ink};font-size:14px;line-height:1.8;">
        <li style="margin-bottom:12px;">Be prepared to discuss your previous academic or project work in detail.</li>
        <li style="margin-bottom:12px;">Keep relevant documents, project materials, or code repositories readily accessible.</li>
        <li style="margin-bottom:0;">Ensure your system is set up with a Linux environment for any potential technical or problem-solving assessments, if applicable.</li>
      </ul>
    </div>
  `
}

function emailShell({ eyebrow, title, intro, body, footer }) {
  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f4efe8;font-family:Arial,Helvetica,sans-serif;color:${brand.ink};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe8;padding:28px 14px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#ffffff;border:1px solid ${brand.line};border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="background:${brand.bg};padding:28px 30px;border-bottom:1px solid ${brand.line};">
                    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${brand.orange};font-weight:800;margin-bottom:10px;">${escapeHtml(eyebrow)}</div>
                    <h1 style="margin:0;color:${brand.ink};font-size:26px;line-height:1.25;">${escapeHtml(title)}</h1>
                    ${intro ? `<p style="margin:14px 0 0;color:${brand.muted};font-size:15px;line-height:1.7;">${intro}</p>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 30px;">
                    ${body}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 30px;background:#fffaf4;border-top:1px solid ${brand.line};color:${brand.muted};font-size:12px;line-height:1.6;">
                    ${footer}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

function companyEmailHtml(application) {
  const name = fullName(application)
  const type = applicantTypeLabel(application.applicantType)
  const rows = [
    ['Applicant name', name],
    ['Role applied for', application.jobTitle],
    ['Application type', type],
    ['Email', application.email],
    ['Phone', application.phone],
    ['Date of birth', application.dob],
    ['Current location', application.currentLocation],
    ['Currently employed', application.currentlyEmployed ? 'Yes' : 'No'],
    ['Employer / notice period', application.employerDetails],
    ['Resume file', application.attachmentDriveLink || application.attachmentFileName],
    ['Project / portfolio file', application.projectDriveLink || application.projectFileName],
    ['Submitted at', formatDateTime(application.createdAt)],
  ]

  return emailShell({
    eyebrow: 'New career application',
    title: `${name} applied for ${application.jobTitle}`,
    intro: `A new ${escapeHtml(type.toLowerCase())} application has been submitted through the PL Robotics careers page.`,
    body: `
      <div style="display:inline-block;background:${brand.orange};color:#fff;font-size:12px;font-weight:800;padding:7px 12px;border-radius:999px;margin-bottom:18px;">
        ${escapeHtml(type)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${rows.map(([label, value]) => detailRow(label, value)).join('')}
      </table>
      <p style="margin:20px 0 0;color:${brand.muted};font-size:13px;line-height:1.7;">
        Resume and project file links are included when available. You can also review this application in the admin panel and Google Sheet.
      </p>
    `,
    footer: 'This notification was generated automatically by the PL Robotics careers system.',
  })
}

function applicantEmailHtml(application) {
  const firstName = application.firstName || 'there'
  const type = applicantTypeLabel(application.applicantType)

  return emailShell({
    eyebrow: 'Application received',
    title: 'Thank you for applying to PL Robotics',
    intro: `Hi ${escapeHtml(firstName)}, we have received your application for the ${escapeHtml(application.jobTitle)} role.`,
    body: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffaf4;border:1px solid ${brand.line};border-radius:14px;margin-bottom:22px;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="color:${brand.muted};font-size:12px;text-transform:uppercase;letter-spacing:1.4px;font-weight:800;margin-bottom:8px;">Applied role</div>
            <div style="color:${brand.ink};font-size:18px;font-weight:800;line-height:1.35;">${escapeHtml(application.jobTitle)}</div>
            <div style="color:${brand.orange};font-size:13px;font-weight:700;margin-top:8px;">${escapeHtml(type)} application</div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 14px;color:${brand.ink};font-size:15px;line-height:1.8;">
        Our team will review your resume and details carefully. If your profile matches the role requirements, we will contact you for the next steps.
      </p>
      <p style="margin:0;color:${brand.muted};font-size:14px;line-height:1.8;">
        Please keep an eye on your email and phone for updates from the PL Robotics team.
      </p>
    `,
    footer: 'Regards,<br><strong style="color:#1a1208;">PL Robotics Careers Team</strong>',
  })
}

function companyText(application) {
  return [
    'New career application',
    '',
    `Applicant: ${fullName(application)}`,
    `Role: ${application.jobTitle}`,
    `Type: ${applicantTypeLabel(application.applicantType)}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    `DOB: ${application.dob}`,
    `Location: ${application.currentLocation || 'Not provided'}`,
    `Currently employed: ${application.currentlyEmployed ? 'Yes' : 'No'}`,
    `Employer details: ${application.employerDetails || 'Not provided'}`,
    `Resume: ${application.attachmentDriveLink || application.attachmentFileName || 'Not attached'}`,
    `Project: ${application.projectDriveLink || application.projectFileName || 'Not attached'}`,
    `Submitted: ${formatDateTime(application.createdAt)}`,
  ].join('\n')
}

function applicantText(application) {
  return [
    `Hi ${application.firstName || 'there'},`,
    '',
    `Thank you for applying for the ${application.jobTitle} role at PL Robotics.`,
    'We have received your application and our team will review it shortly.',
    '',
    'If your profile matches the role requirements, we will contact you for the next steps.',
    '',
    'Regards,',
    'PL Robotics Careers Team',
  ].join('\n')
}

export async function sendApplicationEmails(application) {
  const companyRecipient = process.env.PLR_HR_EMAIL

  if (!process.env.RESEND_API_KEY) {
    console.warn('Application receipt email skipped: RESEND_API_KEY env value is missing.')
    return { skipped: true }
  }

  const name = fullName(application)
  const senderName = process.env.MAIL_FROM_NAME_CAREERS || 'PL Robotics Careers'

  await sendEmail({
    fromName: senderName,
    to: application.email,
    replyTo: companyRecipient || undefined,
    subject: `APPLICATION RECEIVED | ${application.jobTitle} - ${name}`,
    messageId: messageId(application, 'career-receipt'),
    html: applicantEmailHtml(application),
    text: applicantText(application),
  })

  return { skipped: false }
}

export async function sendInterviewScheduledEmail(application) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send interview confirmations')
  }

  const interview = application.interview
  const dateOnly = new Date(interview.startAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' })
  const startTime = new Date(interview.startAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  const endTime = new Date(interview.endAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  const dateTime = `${dateOnly} | ${startTime} to ${endTime} IST`
  const name = fullName(application)
  const senderName = process.env.MAIL_FROM_NAME_CAREERS || 'PL Robotics Careers'
  const rows = [
    ['Role', application.jobTitle],
    ['Date and time', `${dateTime} IST`],
    ['Google Meet link', interview.meetLink],
  ]

  const textInstructions = [
    'Important Instructions:',
    '• Please join the meeting 10-15 minutes before the scheduled time.',
    '• The total duration of the interview process is 2 hours; please be available for the full duration.',
    '• After joining the meeting, please remain in the waiting room until the host admits you for the interview.',
    '• Ensure your camera remains switched ON during the entire interview.',
    '• Please ensure a stable internet connection to avoid any disruptions.',
    '• It is recommended to be seated in a quiet and well-lit environment.',
    '• Please note that this interview schedule is final and will not be rescheduled.',
    '',
    'Preparation Guidelines:',
    '• Be prepared to discuss your previous academic or project work in detail.',
    '• Keep relevant documents, project materials, or code repositories readily accessible.',
    '• Ensure your system is set up with a Linux environment for any potential technical or problem-solving assessments, if applicable.',
  ]

  return sendEmail({
    fromName: senderName,
    to: application.email,
    replyTo: process.env.PLR_HR_EMAIL,
    subject: `INTERVIEW SCHEDULED | ${application.jobTitle} - PL Robotics`,
    messageId: messageId(application, 'interview-scheduled'),
    html: emailShell({
      eyebrow: 'Interview scheduled',
      title: `Your PL Robotics interview is confirmed`,
      intro: `Hi ${escapeHtml(application.firstName || name)}, your interview for ${escapeHtml(application.jobTitle)} has been scheduled.`,
      body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => detailRow(label, value)).join('')}</table>${interviewInstructionsAndGuidelines()}`,
      footer: 'Regards,<br><strong style="color:#1a1208;">PL Robotics Careers Team</strong>',
    }),
    text: [`Hi ${application.firstName || name},`, '', `Your interview for ${application.jobTitle} is scheduled for ${dateTime} IST.`, `Google Meet: ${interview.meetLink}`, '', ...textInstructions, '', 'We look forward to interacting with you and wish you the very best for the interview.', '', 'Regards,', 'PL Robotics Careers Team'].join('\n'),
  })
}

export async function sendInterviewRescheduledEmail(application) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send interview reschedule emails')
  }

  const interview = application.interview
  const dateOnly = new Date(interview.startAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' })
  const startTime = new Date(interview.startAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  const endTime = new Date(interview.endAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  const dateTime = `${dateOnly} | ${startTime} to ${endTime} IST`
  const senderName = process.env.MAIL_FROM_NAME_CAREERS || 'PL Robotics Careers'
  const rows = [
    ['Role', application.jobTitle],
    ['New date and time', `${dateTime}`],
    ['Google Meet link', interview.meetLink],
  ]

  const textInstructions = [
    'Important Instructions:',
    '• Please join the meeting 10-15 minutes before the scheduled time.',
    '• The total duration of the interview process is 2 hours; please be available for the full duration.',
    '• After joining the meeting, please remain in the waiting room until the host admits you for the interview.',
    '• Ensure your camera remains switched ON during the entire interview.',
    '• Please ensure a stable internet connection to avoid any disruptions.',
    '• It is recommended to be seated in a quiet and well-lit environment.',
    '• Please note that this interview schedule is final and will not be rescheduled.',
    '',
    'Preparation Guidelines:',
    '• Be prepared to discuss your previous academic or project work in detail.',
    '• Keep relevant documents, project materials, or code repositories readily accessible.',
    '• Ensure your system is set up with a Linux environment for any potential technical or problem-solving assessments, if applicable.',
  ]

  return sendEmail({
    fromName: senderName,
    to: application.email,
    replyTo: process.env.PLR_HR_EMAIL,
    subject: `INTERVIEW RESCHEDULED | ${application.jobTitle} - PL Robotics`,
    messageId: messageId(application, 'interview-rescheduled'),
    html: emailShell({
      eyebrow: 'Interview rescheduled',
      title: `Your PL Robotics interview has been rescheduled`,
      intro: `Hi ${escapeHtml(application.firstName || name)}, your interview for ${escapeHtml(application.jobTitle)} has been rescheduled.`,
      body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => detailRow(label, value)).join('')}</table>${interviewInstructionsAndGuidelines()}`,
      footer: 'Regards,<br><strong style="color:#1a1208;">PL Robotics Careers Team</strong>',
    }),
    text: [`Hi ${application.firstName || name},`, '', `Your interview for ${application.jobTitle} has been rescheduled to ${dateTime}.`, `Google Meet: ${interview.meetLink}`, '', ...textInstructions, '', 'We look forward to interacting with you and wish you the very best for the interview.', '', 'Regards,', 'PL Robotics Careers Team'].join('\n'),
  })
}

export async function sendInterviewAssignmentEmail(application, interviewer) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send interview assignments')
  }

  const interview = application.interview
  const candidateName = fullName(application)
  const dateTime = new Date(interview.startAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short',
  })
  const senderName = process.env.MAIL_FROM_NAME_CAREERS || 'PL Robotics Careers'
  const rows = [
    ['Candidate', candidateName],
    ['Role', application.jobTitle],
    ['Date and time', `${dateTime} IST`],
    ['Candidate email', application.email],
    ['Candidate phone', application.phone],
    ['Google Meet link', interview.meetLink],
  ]

  return sendEmail({
    fromName: senderName,
    to: interviewer.email,
    replyTo: application.email,
    subject: `INTERVIEW ASSIGNED | ${candidateName} — ${application.jobTitle}`,
    messageId: messageId(application, 'interview-assignment'),
    html: emailShell({
      eyebrow: 'Interview assignment',
      title: `You are assigned to interview ${candidateName}`,
      intro: `Please conduct the candidate interview at the scheduled time using the Google Meet link below.`,
      body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => detailRow(label, value)).join('')}</table>`,
      footer: 'This interview was assigned through the PL Robotics careers system.',
    }),
    text: ['PL Robotics interview assignment', '', ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'),
  })
}

export async function sendInterviewAssignmentRescheduledEmail(application, interviewer) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send interview assignment reschedule emails')
  }

  const interview = application.interview
  const candidateName = fullName(application)
  const dateOnly = new Date(interview.startAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' })
  const startTime = new Date(interview.startAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  const endTime = new Date(interview.endAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  const dateTime = `${dateOnly} | ${startTime} to ${endTime} IST`
  const senderName = process.env.MAIL_FROM_NAME_CAREERS || 'PL Robotics Careers'
  const rows = [
    ['Candidate', candidateName],
    ['Role', application.jobTitle],
    ['New date and time', `${dateTime}`],
    ['Candidate email', application.email],
    ['Candidate phone', application.phone],
    ['Google Meet link', interview.meetLink],
  ]

  return sendEmail({
    fromName: senderName,
    to: interviewer.email,
    replyTo: application.email,
    subject: `INTERVIEW REASSIGNED (RESCHEDULED) | ${candidateName} — ${application.jobTitle}`,
    messageId: messageId(application, 'interview-assignment-rescheduled'),
    html: emailShell({
      eyebrow: 'Interview reassigned',
      title: `Interview updated: ${candidateName}`,
      intro: `The interview for ${escapeHtml(candidateName)} has been rescheduled. Please note the updated time below.`,
      body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => detailRow(label, value)).join('')}</table>`,
      footer: 'This interview update was generated automatically by the PL Robotics careers system.',
    }),
    text: ['Interview update', '', ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'),
  })
}

export async function sendInterviewCancelledEmail(application) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send interview cancellation emails')
  }

  const interview = application.interview || {}
  const dateOnly = interview.startAt ? new Date(interview.startAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' }) : ''
  const senderName = process.env.MAIL_FROM_NAME_CAREERS || 'PL Robotics Careers'

  const rows = [
    ['Role', application.jobTitle],
    ['Date', dateOnly],
  ]

  return sendEmail({
    fromName: senderName,
    to: application.email,
    replyTo: process.env.PLR_HR_EMAIL,
    subject: `INTERVIEW CANCELLED | ${application.jobTitle} - PL Robotics`,
    messageId: messageId(application, 'interview-cancelled'),
    html: emailShell({
      eyebrow: 'Interview cancelled',
      title: `Your PL Robotics interview has been cancelled`,
      intro: `Hi ${escapeHtml(application.firstName || fullName(application))}, unfortunately your interview for ${escapeHtml(application.jobTitle)} has been cancelled.`,
      body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => detailRow(label, value)).join('')}</table>
        <p style="margin:22px 0 0;color:${brand.ink};font-size:15px;line-height:1.8;">We will contact you if the interview is rescheduled. If you have any questions, reply to this email.</p>`,
      footer: 'Regards,<br><strong style="color:#1a1208;">PL Robotics Careers Team</strong>',
    }),
    text: [`Hi ${application.firstName || fullName(application)},`, '', `Your interview for ${application.jobTitle} has been cancelled.`, '', 'Regards,', 'PL Robotics Careers Team'].join('\n'),
  })
}

export async function sendInterviewAssignmentCancelledEmail(application, interviewer) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send interview cancellation emails')
  }

  const interview = application.interview || {}
  const dateOnly = interview.startAt ? new Date(interview.startAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' }) : ''
  const candidateName = fullName(application)
  const senderName = process.env.MAIL_FROM_NAME_CAREERS || 'PL Robotics Careers'
  const rows = [
    ['Candidate', candidateName],
    ['Role', application.jobTitle],
    ['Date', dateOnly],
  ]

  return sendEmail({
    fromName: senderName,
    to: interviewer.email,
    replyTo: application.email,
    subject: `INTERVIEW CANCELLED | ${candidateName} — ${application.jobTitle}`,
    messageId: messageId(application, 'interview-assignment-cancelled'),
    html: emailShell({
      eyebrow: 'Interview cancelled',
      title: `Interview with ${escapeHtml(candidateName)} has been cancelled`,
      intro: `The interview assigned to you has been cancelled.`,
      body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows.map(([label, value]) => detailRow(label, value)).join('')}</table>`,
      footer: 'This notification was generated automatically by the PL Robotics careers system.',
    }),
    text: ['Interview cancelled', '', ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'),
  })
}

function inquiryRecipient() {
  return process.env.PLR_CONTACT_EMAIL || 'contact@plrobotics.com'
}

async function sendWebsiteNotification({ subject, eyebrow, title, intro, rows, replyTo, messageId: notificationMessageId, senderName }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Website notification email skipped: RESEND_API_KEY env value is missing.')
    return { skipped: true }
  }

  await sendEmail({
    fromName: senderName,
    to: inquiryRecipient(),
    replyTo,
    subject,
    messageId: notificationMessageId,
    html: emailShell({
      eyebrow,
      title,
      intro,
      body: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${rows.map(([label, value]) => detailRow(label, value)).join('')}
        </table>
      `,
      footer: 'This notification was generated automatically by the PL Robotics website.',
    }),
    text: [title, '', ...rows.map(([label, value]) => `${label}: ${value || 'Not provided'}`)].join('\n'),
  })

  return { skipped: false }
}

export function sendContactInquiryEmail(inquiry) {
  const name = `${inquiry.firstName} ${inquiry.lastName}`.trim()
  return sendWebsiteNotification({
    subject: `CONTACT ENQUIRY | Message from ${name}`,
    senderName: process.env.MAIL_FROM_NAME_CONTACT || 'PL Robotics Contact',
    messageId: messageId(inquiry, 'contact-enquiry'),
    eyebrow: 'New contact enquiry',
    title: `${name} wants to contact PL Robotics`,
    intro: 'A new contact enquiry has been submitted through the PL Robotics website.',
    replyTo: inquiry.email,
    rows: [
      ['Name', name],
      ['Phone', inquiry.phone],
      ['Email', inquiry.email],
      ['Reason to contact', inquiry.reason],
      ['Submitted at', formatDateTime(inquiry.createdAt)],
    ],
  })
}

export function sendDemoRequestEmail(request) {
  const name = `${request.firstName} ${request.lastName}`.trim()
  return sendWebsiteNotification({
    subject: `DEMO REQUEST | Industrial Automation Demo - ${name}`,
    senderName: process.env.MAIL_FROM_NAME_DEMO || 'PL Robotics Demo',
    messageId: messageId(request, 'demo-request'),
    eyebrow: 'New demo request',
    title: `${name} requested a PL Robotics demo`,
    intro: 'A new demo request has been submitted through the PL Robotics website.',
    replyTo: request.companyEmail,
    rows: [
      ['Name', name],
      ['Company', request.companyName],
      ['Company email', request.companyEmail],
      ['Company address', request.companyAddress],
      ['Company contact', request.companyContact],
      ['Interested robot / service', request.interestedIn],
      ['Industry type', request.industryType],
      ['Application', request.application],
      ['Submitted at', formatDateTime(request.createdAt)],
    ],
  })
}
