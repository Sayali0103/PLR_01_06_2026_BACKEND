# PL Robotics backend

The Express API stores applications in MongoDB and sends files to Google Drive,
application records to Google Sheets, and notifications through Resend.

## Interview scheduling

The admin dashboard can schedule a batch of 1–10 candidates on a future
Thursday or Sunday. It uses a shared Meet link for candidates in the same
slot and sends a confirmation email.

## Employee dashboard

Admin and HR accounts can review monthly working, approved leave, and absent
counts for each employee; view employee login/logout timestamps and WFH days;
manage attendance and leave; and assign tasks. Employees select their work
location when signing in, can review assigned tasks, and can submit task
status and progress updates for admin/HR review. Monthly attendance counts
include present and WFH days as working days, with half days counted as 0.5.

Copy `.env.example` into `.env` and provide the shared interview link under
`INTERVIEW_MEET_LINK`.
