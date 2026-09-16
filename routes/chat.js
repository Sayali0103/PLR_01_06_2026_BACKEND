import express from 'express'
import Job from '../models/Job.js'

const router = express.Router()
const attempts = new Map()
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 30

const action = (label, to) => ({ label, to })

function rateLimit(req, res, next) {
  const now = Date.now()
  const key = req.ip
  const recent = (attempts.get(key) || []).filter(time => now - time < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many chat messages. Please try again in a few minutes.' })
  }
  recent.push(now)
  attempts.set(key, recent)
  next()
}

function answerFor(message) {
  const text = message.toLowerCase()

  if (/\b(job|jobs|career|careers|opening|openings|hiring|apply|application|intern|internship|role|roles|vacancy)\b/.test(text)) return 'jobs'
  if (/\b(where|location|located|address|office|pune|bhosari|visit)\b/.test(text)) {
    return {
      reply: 'P. L. Robotics is based in Pune, India. Our R&D centre is in Bhosari, Pune. You can contact us at contact@plrobotics.com or use the numbers in the website footer.',
      actions: [action('Contact us', '/contact')],
    }
  }
  if (/\b(product|products|robot|robots|cobot|cobots|scara|delta|cartesian|co5)\b/.test(text)) {
    return {
      reply: 'We offer collaborative robots for flexible factory automation, custom-built Cartesian robots, the VSCARA VS3 for high-speed press-machine handling, and the Delta DR1 for fast pick-and-place, sorting, stacking, and palletizing.',
      actions: [action('Explore products', '/#product-showcase'), action('Book a demo', '/book-demo')],
    }
  }
  if (/\b(do|service|services|automate|automation|application|cnc|weld|welding|packag|inspect|inspection|pallet|assembly|press)\b/.test(text)) {
    return {
      reply: 'PLR designs industrial automation for CNC machine tending, assembly, quality inspection, welding, press-machine tending, packaging, pick-and-place, palletizing, and custom workflows. We can integrate robots with existing machines, conveyors, fixtures, sensors, and shop-floor systems.',
      actions: [action('View applications', '/applications'), action('Discuss your process', '/book-demo')],
    }
  }
  if (/\b(technology|software|vision|camera|telemetr|monitor|racs|teach pendant)\b/.test(text)) {
    return {
      reply: 'Our technology includes RACS visual workflow software, real-time telemetric monitoring with alerts and multi-robot visibility, and vision systems for detection, guided picking, tracking, inspection, and sorting.',
      actions: [action('Explore technology', '/technology'), action('Book a demo', '/book-demo')],
    }
  }
  if (/\b(contact|email|phone|call|demo|quote|consult)\b/.test(text)) {
    return {
      reply: 'You can reach P. L. Robotics at contact@plrobotics.com. For product demonstrations or automation consultation, send us your requirements and the team will get in touch.',
      actions: [action('Book a demo', '/book-demo'), action('Contact us', '/contact')],
    }
  }
  if (/\b(hello|hi|hey)\b/.test(text)) {
    return {
      reply: 'Hello! I can help you explore PLR products, automation applications, technology, our Pune location, and current job openings.',
      actions: [action('Explore products', '/#product-showcase'), action('View careers', '/careers')],
    }
  }
  return {
    reply: 'I can help with PLR products, automation applications, technology, our Pune location, and current career openings. For a specific project question, our team can help directly.',
    actions: [action('Explore products', '/#product-showcase'), action('View careers', '/careers'), action('Contact us', '/contact')],
  }
}

router.post('/', rateLimit, async (req, res) => {
  const message = String(req.body?.message || '').trim()
  if (!message) return res.status(400).json({ error: 'Please enter a message.' })
  if (message.length > 500) return res.status(400).json({ error: 'Please keep your message under 500 characters.' })

  try {
    const response = answerFor(message)
    if (response !== 'jobs') return res.json(response)

    const jobs = await Job.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('title dept location positionType tags')
      .lean()

    if (!jobs.length) {
      return res.json({
        reply: 'There are no active openings listed right now. Please check the Careers page again soon.',
        actions: [action('Visit careers', '/careers')],
      })
    }

    const jobSummary = jobs.slice(0, 6).map(job => `${job.title} (${job.dept}, ${job.location})`).join('; ')
    return res.json({
      reply: `Current openings: ${jobSummary}. Visit Careers to see each role’s requirements and submit an application.`,
      actions: [action('View and apply', '/careers')],
    })
  } catch (error) {
    console.error('Chat response error:', error.message)
    return res.status(500).json({ error: 'The assistant is temporarily unavailable. Please try again shortly.' })
  }
})

export default router
