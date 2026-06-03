import express from 'express'
import Application from '../models/Application.js'
import { adminAuth } from '../middleware/auth.js'
import { handleUploadError, uploadFields } from '../middleware/upload.js'
import { appendApplicationToSheet } from '../googleSheets.js'
import { sendApplicationEmails } from '../services/mailService.js'
import { removeLocalUpload, uploadApplicationFileToDrive } from '../services/driveService.js'

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
