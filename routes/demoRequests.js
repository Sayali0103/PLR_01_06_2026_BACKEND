import express from 'express'
import DemoRequest from '../models/DemoRequest.js'
import { submissionRateLimit } from '../middleware/submissionRateLimit.js'
import { appendDemoRequestToSheet } from '../googleSheets.js'
import { sendDemoRequestEmail } from '../services/mailService.js'

const router = express.Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/', submissionRateLimit, async (req, res) => {
  try {
    const {
      firstName, lastName, companyName, companyEmail, companyAddress, companyContact,
      interestedIn, industryType, application, website,
    } = req.body

    if (website) return res.status(201).json({ message: 'Demo request submitted successfully' })

    const requiredFields = [
      firstName, lastName, companyName, companyEmail, companyAddress, companyContact,
      interestedIn, industryType, application,
    ]
    if (!requiredFields.every(value => String(value || '').trim())) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    if (!EMAIL_PATTERN.test(companyEmail)) {
      return res.status(400).json({ error: 'Please enter a valid company email address' })
    }

    const demoRequest = await DemoRequest.create({
      firstName, lastName, companyName, companyEmail, companyAddress, companyContact,
      interestedIn, industryType, application,
    })

    appendDemoRequestToSheet(demoRequest).catch(err =>
      console.error('Demo request sheet append error:', err.message)
    )
    sendDemoRequestEmail(demoRequest).catch(err =>
      console.error('Demo request email error:', err.message)
    )

    res.status(201).json({ message: 'Demo request submitted successfully' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
