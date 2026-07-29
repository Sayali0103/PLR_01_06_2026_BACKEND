import express from 'express'
import Application from '../models/Application.js'
import InterviewBatch from '../models/InterviewBatch.js'
import { interviewers } from '../config/interviewers.js'
import { adminAuth } from '../middleware/auth.js'
import { handleUploadError, uploadFields } from '../middleware/upload.js'
import { appendApplicationToSheet } from '../googleSheets.js'
import { sendApplicationEmails, sendInterviewScheduledEmail, sendInterviewAssignmentEmail } from '../services/mailService.js'
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
  const { applicationIds, date, assignments } = req.body
  if (!Array.isArray(applicationIds) || applicationIds.length < 1 || applicationIds.length > 10) {
    return res.status(400).json({ error: 'Select between 1 and 10 candidates.' })
  }
  if (new Set(applicationIds).size !== applicationIds.length || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'Provide unique candidates and a valid interview date.' })
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

  const dayStart = new Date(`${date}T00:00:00+05:30`)
  const dayEnd = new Date(`${date}T23:59:59.999+05:30`)
  const weekday = new Date(`${date}T12:00:00+05:30`).getDay()
  const windowStart = new Date(`${date}T15:00:00+05:30`)
  if (![0, 4].includes(weekday) || windowStart <= new Date()) {
    return res.status(400).json({ error: 'Interviews must be scheduled for a future Thursday or Sunday.' })
  }

  try {
    const alreadyScheduled = await Application.countDocuments({
      'interview.startAt': { $gte: dayStart, $lte: dayEnd },
      'interview.status': 'scheduled',
    })
    if (alreadyScheduled) return res.status(409).json({ error: 'An interview batch already exists for this date.' })

    const applications = await Application.find({ _id: { $in: applicationIds } })
    if (applications.length !== applicationIds.length) return res.status(404).json({ error: 'One or more applications no longer exist.' })
    if (applications.some(application => application.interview?.status === 'scheduled')) {
      return res.status(409).json({ error: 'A selected candidate already has a scheduled interview.' })
    }

    let batch
    try {
      batch = await InterviewBatch.create({ interviewDate: date, applicationIds })
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ error: 'An interview batch already exists for this date.' })
      throw err
    }

    const ordered = applicationIds.map(id => ({
      application: applications.find(application => application._id.toString() === id),
      interviewer: interviewerByApplicationId.get(id),
    }))
    const slotLengthMs = (2 * 60 * 60 * 1000) / ordered.length
    const createdEvents = []
    try {
      for (let index = 0; index < ordered.length; index += 1) {
        const startAt = new Date(windowStart.getTime() + index * slotLengthMs)
        const endAt = new Date(startAt.getTime() + slotLengthMs)
        const { application, interviewer } = ordered[index]
        const calendar = await createInterviewCalendarEvent({ application, interviewer, startAt, endAt })
        createdEvents.push({ application, interviewer, startAt, endAt, calendar })
      }
    } catch (err) {
      await Promise.allSettled(createdEvents.map(({ calendar }) => deleteInterviewCalendarEvent(calendar.eventId)))
      await batch.deleteOne()
      throw err
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
    const emailResults = await Promise.allSettled(createdEvents.flatMap(item => [
      sendInterviewScheduledEmail(item.application),
      sendInterviewAssignmentEmail(item.application, item.interviewer),
    ]))
    const failedEmails = emailResults.filter(result => result.status === 'rejected').length
    res.status(201).json({ scheduled: scheduled.length, failedEmails })
  } catch (err) {
    console.error('Interview scheduling error:', err.message)
    res.status(400).json({ error: err.message || 'Unable to schedule interviews.' })
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
