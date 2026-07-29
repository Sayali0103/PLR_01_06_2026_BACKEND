# PL Robotics backend

The Express API stores applications in MongoDB and sends files to Google Drive,
application records to Google Sheets, and notifications through Resend.

## Interview scheduling

The admin dashboard can schedule a batch of 1–10 candidates on a future
Thursday or Sunday. It divides the 3:00–5:00 PM IST window equally, creates a
Google Calendar event and unique Google Meet link for every candidate, and
sends a confirmation email.

Copy `.env.example` into `.env` and provide the Google Calendar OAuth values.
The refresh token must have permission to create Calendar events and conference
data; `GOOGLE_CALENDAR_ID` can be `primary` or the ID of a shared interview
calendar.
