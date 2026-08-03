import express from 'express'
import Application from '../models/Application.js'
import InterviewBatch from '../models/InterviewBatch.js'
import { interviewers } from '../config/interviewers.js'
import { adminAuth } from '../middleware/auth.js'
import { handleUploadError, uploadFields } from '../middleware/upload.js'
import { appendApplicationToSheet } from '../googleSheets.js'
import { sendApplicationEmails, sendInterviewScheduledEmail, sendInterviewAssignmentEmail, sendInterviewRescheduledEmail, sendInterviewAssignmentRescheduledEmail, sendInterviewCancelledEmail, sendInterviewAssignmentCancelledEmail } from '../services/mailService.js'
import { removeLocalUpload, uploadApplicationFileToDrive } from '../services/driveService.js'
import { createInterviewCalendarEvent, deleteInterviewCalendarEvent } from '../services/calendarService.js'

const router = express.Router()

async function sendApplicationEmailsSafely(application) {
  try {
    await sendApplicationEmails(application)
  } catch (err) {
    console.error('Application email error:', err.message)
  }
}

function queueApplicationDelivery(application) {
  setImmediate(() => {
    appendApplicationToSheet(application).catch(err =>
      console.error('Sheet append error:', err.message)
    )
    sendApplicationEmailsSafely(application)
  })
}

async function uploadFilesToDrive(files = {}) {
  const resumeFile = files.attachment?.[0]
  const projectFile = files.project?.[0]

  try {
    const [resumeDriveFile, projectDriveFile] = await Promise.all([
      uploadApplicationFileToDrive(resumeFile, 'resume'),
      uploadApplicationFileToDrive(projectFile, 'project'),
    ])

    return { resumeFile, projectFile, resumeDriveFile, projectDriveFile }
  } finally {
    await Promise.all([
      removeLocalUpload(resumeFile),
      removeLocalUpload(projectFile),
    ])
  }
}

router.post('/apply', uploadFields, handleUploadError, async (req, res) => {
  try {
    const { resumeFile, projectFile, resumeDriveFile, projectDriveFile } = await uploadFilesToDrive(req.files)

    // save to DB
    const application = await Application.create({
      ...req.body,
      currentlyEmployed: req.body.currentlyEmployed === 'true',
      attachmentFileName: resumeFile?.filename || '',
      attachmentDriveFileId: resumeDriveFile?.id || '',
      attachmentDriveLink: resumeDriveFile?.webViewLink || '',
      projectFileName: projectFile?.filename || '',
      projectDriveFileId: projectDriveFile?.id || '',
      projectDriveLink: projectDriveFile?.webViewLink || '',
    })

    res.status(201).json({ success: true })
    queueApplicationDelivery(application)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST submit application (public)
router.post('/', uploadFields, handleUploadError, async (req, res) => {
  try {
    const {
      jobId, jobTitle, applicantType,
      firstName, middleName, lastName,
      dob, phone, email,
      currentLocation,
      currentlyEmployed,
      employerDetails,
    } = req.body

    if (!jobId || !jobTitle || !applicantType || !firstName || !lastName || !dob || !phone || !email) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const { resumeFile, projectFile, resumeDriveFile, projectDriveFile } = await uploadFilesToDrive(req.files)

    const application = new Application({
      jobId, jobTitle, applicantType,
      firstName, middleName: middleName || '', lastName,
      dob, phone, email,
      currentLocation: currentLocation || '',
      currentlyEmployed: currentlyEmployed === 'true',
      employerDetails: employerDetails || '',
      attachmentFileName: resumeFile?.filename || '',
      attachmentDriveFileId: resumeDriveFile?.id || '',
      attachmentDriveLink: resumeDriveFile?.webViewLink || '',
      projectFileName: projectFile?.filename || '',
      projectDriveFileId: projectDriveFile?.id || '',
      projectDriveLink: projectDriveFile?.webViewLink || '',
    })

    await application.save()

    res.status(201).json({ message: 'Application submitted successfully' })
    queueApplicationDelivery(application)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET all applications (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const apps = await Application.find()
      .populate('jobId', 'title dept')
      .sort({ createdAt: -1 })
    res.json(apps)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
})

router.get('/interviewers', adminAuth, (req, res) => {
  res.json(interviewers)
})

// Schedule a single Thursday/Sunday interview batch. The 3–5 PM IST window is shared evenly.
router.post('/schedule-interviews', adminAuth, async (req, res) => {
  const { applicationIds, date, startTime, durationHours, assignments } = req.body
  if (!Array.isArray(applicationIds) || applicationIds.length < 1 || applicationIds.length > 10) {
    return res.status(400).json({ error: 'Select between 1 and 10 candidates.' })
  }
  if (new Set(applicationIds).size !== applicationIds.length || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'Provide unique candidates and a valid interview date.' })
  }
  if (!/^\d{2}:\d{2}$/.test(startTime || '')) {
    return res.status(400).json({ error: 'Provide a valid interview start time.' })
  }
  if (![1, 2].includes(Number(durationHours))) {
    return res.status(400).json({ error: 'Choose a 1-hour or 2-hour interview duration.' })
  }
  if (!Array.isArray(assignments) || assignments.length !== applicationIds.length) {
    return res.status(400).json({ error: 'Assign an interviewer to every candidate.' })
  }

  const assignmentMap = new Map(assignments.map(assignment => [assignment.applicationId, assignment.interviewerEmail?.toLowerCase()]))
  if (assignmentMap.size !== applicationIds.length || applicationIds.some(id => !assignmentMap.has(id))) {
    return res.status(400).json({ error: 'Assign one interviewer to every selected candidate.' })
  }

  const interviewerByApplicationId = new Map(applicationIds.map(id => {
    const interviewer = interviewers.find(person => person.email.toLowerCase() === assignmentMap.get(id))
    return [id, interviewer]
  }))
  if ([...interviewerByApplicationId.values()].some(interviewer => !interviewer)) {
    return res.status(400).json({ error: 'One or more selected interviewers are invalid.' })
  }

  const slotStart = new Date(`${date}T${startTime}:00+05:30`)
  const now = new Date()
  if (slotStart <= now) {
    return res.status(400).json({ error: 'Interviews must be scheduled for a future date and time.' })
  }

  try {
    const existingBatch = await InterviewBatch.findOne({ interviewDate: date })
    const existingIds = existingBatch ? existingBatch.applicationIds.map(id => id.toString()) : []
    const existingCount = existingIds.length

    if (existingCount >= 10) {
      return res.status(409).json({ error: 'The interview slot for this date is already fully booked.' })
    }
    if (existingCount + applicationIds.length > 10) {
      return res.status(409).json({ error: `Only ${10 - existingCount} candidate slot(s) remain for this date.` })
    }
    if (existingBatch && applicationIds.some(id => existingIds.includes(id))) {
      return res.status(400).json({ error: 'One or more selected candidates are already scheduled for this date.' })
    }

    const applications = await Application.find({ _id: { $in: applicationIds } })
    if (applications.length !== applicationIds.length) {
      return res.status(404).json({ error: 'One or more applications no longer exist.' })
    }
    if (applications.some(application => application.interview?.status === 'scheduled')) {
      return res.status(409).json({ error: 'A selected candidate already has a scheduled interview.' })
    }

    const ordered = applicationIds.map(id => ({
      application: applications.find(application => application._id.toString() === id),
      interviewer: interviewerByApplicationId.get(id),
    }))

    const slotLengthMs = Number(durationHours) * 60 * 60 * 1000
    const createdEvents = []

    try {
      for (let index = 0; index < ordered.length; index += 1) {
        const slotIndex = existingCount + index
        const startAt = new Date(slotStart.getTime() + slotIndex * slotLengthMs)
        const endAt = new Date(startAt.getTime() + slotLengthMs)
        const { application, interviewer } = ordered[index]
        const calendar = await createInterviewCalendarEvent({ application, interviewer, startAt, endAt })
        createdEvents.push({ application, interviewer, startAt, endAt, calendar })
      }

      const scheduled = []
      for (const item of createdEvents) {
        item.application.interview = {
          startAt: item.startAt,
          endAt: item.endAt,
          timezone: 'Asia/Kolkata',
          meetLink: item.calendar.meetLink,
          calendarEventId: item.calendar.eventId,
          interviewerName: item.interviewer.name,
          interviewerEmail: item.interviewer.email,
          status: 'scheduled',
          scheduledAt: new Date(),
        }
        await item.application.save()
        scheduled.push(item.application)
      }

      if (existingBatch) {
        existingBatch.applicationIds.push(...applicationIds)
        await existingBatch.save()
      } else {
        await InterviewBatch.create({ interviewDate: date, applicationIds })
      }

      const emailResults = await Promise.allSettled(createdEvents.flatMap(item => [
        sendInterviewScheduledEmail(item.application),
        sendInterviewAssignmentEmail(item.application, item.interviewer),
      ]))
      const failedEmails = emailResults.filter(result => result.status === 'rejected').length

      res.status(201).json({ scheduled: scheduled.length, failedEmails })
    } catch (err) {
      await Promise.allSettled(createdEvents.map(({ calendar }) => deleteInterviewCalendarEvent(calendar.eventId)))
      throw err
    }
  } catch (err) {
    console.error('Interview scheduling error:', err.message)
    res.status(400).json({ error: err.message || 'Unable to schedule interviews.' })
  }
})

// Edit a single application's interview (reschedule or change interviewer)
router.patch('/:id/edit-interview', adminAuth, async (req, res) => {
  const { date, startTime, durationHours, interviewerEmail } = req.body
  if (!/^[\d]{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(startTime || '') || !interviewerEmail) {
    return res.status(400).json({ error: 'Provide a valid date, start time, and interviewer email.' })
  }
  if (![1, 2].includes(Number(durationHours))) {
    return res.status(400).json({ error: 'Choose a 1-hour or 2-hour interview duration.' })
  }

  try {
    const application = await Application.findById(req.params.id)
    if (!application) return res.status(404).json({ error: 'Application not found.' })

    const interviewer = interviewers.find(p => p.email.toLowerCase() === interviewerEmail.toLowerCase())
    if (!interviewer) return res.status(400).json({ error: 'Invalid interviewer email.' })

    // Remove from any existing batch for this candidate
    const oldBatch = await InterviewBatch.findOne({ applicationIds: application._id })
    if (oldBatch) {
      oldBatch.applicationIds = oldBatch.applicationIds.filter(id => id.toString() !== application._id.toString())
      await oldBatch.save()
    }

    const slotStart = new Date(`${date}T${startTime}:00+05:30`)
    if (slotStart <= new Date()) {
      return res.status(400).json({ error: 'Interviews must be scheduled for a future date and time.' })
    }

    // Find or create target batch and ensure capacity
    let targetBatch = await InterviewBatch.findOne({ interviewDate: date })
    const existingCount = targetBatch ? targetBatch.applicationIds.length : 0
    if (existingCount >= 10) return res.status(409).json({ error: 'The interview slot for this date is already fully booked.' })

    const slotLengthMs = Number(durationHours) * 60 * 60 * 1000
    const slotIndex = existingCount
    const startAt = new Date(slotStart.getTime() + slotIndex * slotLengthMs)
    const endAt = new Date(startAt.getTime() + slotLengthMs)

    // Create new calendar event
    const calendar = await createInterviewCalendarEvent({ application, interviewer, startAt, endAt })

    // Delete old calendar event if present
    if (application.interview?.calendarEventId) {
      await deleteInterviewCalendarEvent(application.interview.calendarEventId)
    }

    // Update application interview details
    application.interview = {
      startAt,
      endAt,
      timezone: 'Asia/Kolkata',
      meetLink: calendar.meetLink,
      calendarEventId: calendar.eventId,
      interviewerName: interviewer.name,
      interviewerEmail: interviewer.email,
      status: 'scheduled',
      scheduledAt: new Date(),
    }
    await application.save()

    // Update or create batch record
    if (targetBatch) {
      targetBatch.applicationIds.push(application._id)
      await targetBatch.save()
    } else {
      await InterviewBatch.create({ interviewDate: date, applicationIds: [application._id] })
    }

    // Notify candidate and interviewer (reschedule)
    await Promise.allSettled([
      sendInterviewRescheduledEmail(application),
      sendInterviewAssignmentRescheduledEmail(application, interviewer),
    ])

    res.json({ message: 'Interview updated successfully' })
  } catch (err) {
    console.error('Edit interview error:', err.message)
    res.status(400).json({ error: err.message || 'Unable to edit interview.' })
  }
})

// Cancel an interview for a single application
router.post('/:id/cancel-interview', adminAuth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
    if (!application || application.interview?.status !== 'scheduled') return res.status(404).json({ error: 'Scheduled interview not found for this application.' })

    const interviewer = { email: application.interview?.interviewerEmail, name: application.interview?.interviewerName }

    // Delete calendar event
    if (application.interview.calendarEventId) {
      await deleteInterviewCalendarEvent(application.interview.calendarEventId)
    }

    // Mark as cancelled
    application.interview = {
      ...application.interview,
      status: 'cancelled',
      cancelledAt: new Date(),
    }
    await application.save()

    // Remove from any batch that contains this application
    const batch = await InterviewBatch.findOne({ applicationIds: application._id })
    if (batch) {
      batch.applicationIds = batch.applicationIds.filter(id => id.toString() !== application._id.toString())
      await batch.save()
    }

    // Notify candidate and interviewer
    await Promise.allSettled([
      sendInterviewCancelledEmail(application),
      interviewer?.email ? sendInterviewAssignmentCancelledEmail(application, interviewer) : Promise.resolve(),
    ])

    res.json({ message: 'Interview cancelled' })
  } catch (err) {
    console.error('Cancel interview error:', err.message)
    res.status(400).json({ error: err.message || 'Unable to cancel interview.' })
  }
})

// PATCH update status (admin only)
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const app = await Application.findByIdAndUpdate(
      req.params.id, { status: req.body.status }, { new: true }
    )
    if (!app) return res.status(404).json({ error: 'Not found' })
    res.json(app)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// DELETE application (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' })
  }
})

export default router
