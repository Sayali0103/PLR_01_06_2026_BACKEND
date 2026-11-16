# PL Robotics backend

The Express API stores applications in MongoDB and sends files to Google Drive,
application records to Google Sheets, and notifications through Resend.

## Interview scheduling

The admin dashboard can schedule a batch of 1–10 candidates on a future
Thursday or Sunday. It uses a shared Meet link for candidates in the same
slot and sends a confirmation email.

## Employee dashboard

Admin and HR accounts can review monthly present, leave, and absent counts for
active employees; view employee login/logout timestamps and hours worked;
manage attendance and leave; upload private employee documents; and assign tasks.
Past employees and interns are available in a separate dashboard tab with their
historical attendance. Employees can download documents shared with their own
account. Attendance can be marked as informed leave, and approved leave requests
appear as informed leave on the employee calendar.
Employees select their work location when signing in, can review assigned
tasks, submit task status and progress updates, and change their password.
Monthly present counts include WFH and count half days as 0.5.

Admin and HR users can change their own dashboard passwords. Updated admin and
HR password hashes are stored in MongoDB and take precedence over the initial
`ADMIN_PASSWORD` and `HR_PASSWORD` environment values.

Copy `.env.example` into `.env` and provide the shared interview link under
`INTERVIEW_MEET_LINK`.

For deployment, set `MONGO_URI`, `ADMIN_PASSWORD`, and `HR_PASSWORD` in the
backend environment. Bind to `0.0.0.0` (the default) and set
`FRONTEND_ORIGIN` to any additional frontend origins as a comma-separated
list. The production site origins `https://plrobotics.in` and
`https://www.plrobotics.in` are allowed by default.
