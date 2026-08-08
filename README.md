# PL Robotics backend

The Express API stores applications in MongoDB and sends files to Google Drive,
application records to Google Sheets, and notifications through Resend.

## Interview scheduling

The admin dashboard can schedule a batch of 1–10 candidates on a future
Thursday or Sunday. It uses a shared Meet link for candidates in the same
slot and sends a confirmation email.

Copy `.env.example` into `.env` and provide the shared interview link under
`INTERVIEW_MEET_LINK`.
