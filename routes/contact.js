import express from 'express'
import ContactInquiry from '../models/ContactInquiry.js'
import { submissionRateLimit } from '../middleware/submissionRateLimit.js'
import { appendContactInquiryToSheet } from '../googleSheets.js'
import { sendContactInquiryEmail } from '../services/mailService.js'

const router = express.Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/', submissionRateLimit, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, reason, website } = req.body

    if (website) return res.status(201).json({ message: 'Contact enquiry submitted successfully' })
    if (![firstName, lastName, phone, email, reason].every(value => String(value || '').trim())) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' })
    }

    const inquiry = await ContactInquiry.create({ firstName, lastName, phone, email, reason })

    appendContactInquiryToSheet(inquiry).catch(err =>
      console.error('Contact sheet append error:', err.message)
    )
    sendContactInquiryEmail(inquiry).catch(err =>
      console.error('Contact email error:', err.message)
    )

    res.status(201).json({ message: 'Contact enquiry submitted successfully' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
