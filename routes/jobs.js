import express from 'express'
import Job from '../models/Job.js'
import { adminAuth } from '../middleware/auth.js'

const router = express.Router()

// GET all active jobs (public)
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 })
    res.json(jobs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' })
  }
})

// GET all jobs including inactive (admin only)
router.get('/all', adminAuth, async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 })
    res.json(jobs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' })
  }
})

// GET single job by id (public)
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job' })
  }
})

// POST create job (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const job = new Job(req.body)
    await job.save()
    res.status(201).json(job)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// PUT update job (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!job) return res.status(404).json({ error: 'Job not found' })
    res.json(job)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// DELETE job (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    res.json({ message: 'Job deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete job' })
  }
})

export default router