import express from 'express'
import Employee from '../models/Employee.js'
import Attendance from '../models/Attendance.js'
import { adminAuth } from '../middleware/auth.js'

const router = express.Router()
const START_DATE = '2026-09-01'
const HOLIDAYS = new Set([
  '2026-09-14', '2026-09-25', '2026-10-02', '2026-10-20',
  '2026-11-08', '2026-11-11', '2026-12-25',
])

function isHoliday(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 4 || HOLIDAYS.has(date)
}

function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
}

// Public employee directory and read-only attendance portal.
router.get('/public', async (_req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }).select('name email').sort({ name: 1 })
    res.json(employees)
  } catch {
    res.status(500).json({ error: 'Failed to fetch employees' })
  }
})

router.get('/:id/attendance', async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isActive: true }).select('name email')
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    const attendance = await Attendance.find({ employeeId: employee._id }).sort({ date: 1 })
    res.json({ employee, attendance })
  } catch {
    res.status(400).json({ error: 'Failed to fetch attendance' })
  }
})

router.get('/', adminAuth, async (_req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 })
    res.json(employees)
  } catch {
    res.status(500).json({ error: 'Failed to fetch employees' })
  }
})

router.post('/', adminAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' })
    const employee = await Employee.create({ name, email })
    res.status(201).json(employee)
  } catch (err) {
    res.status(400).json({ error: err.code === 11000 ? 'An employee with this email already exists' : err.message })
  }
})

router.get('/:id/admin-attendance', adminAuth, async (req, res) => {
  try {
    const attendance = await Attendance.find({ employeeId: req.params.id }).sort({ date: 1 })
    res.json(attendance)
  } catch {
    res.status(400).json({ error: 'Failed to fetch attendance' })
  }
})

router.put('/:id/attendance/:date', adminAuth, async (req, res) => {
  const { date } = req.params
  const { status } = req.body
  if (!validDate(date) || date < START_DATE || isHoliday(date)) {
    return res.status(400).json({ error: 'Attendance can only be marked on working days from 1 September 2026' })
  }
  if (!['present', 'absent'].includes(status)) {
    return res.status(400).json({ error: 'Status must be present or absent' })
  }
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isActive: true })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    const attendance = await Attendance.findOneAndUpdate(
      { employeeId: employee._id, date },
      { status },
      { new: true, upsert: true, runValidators: true }
    )
    res.json(attendance)
  } catch {
    res.status(400).json({ error: 'Failed to save attendance' })
  }
})

router.delete('/:id/attendance/:date', adminAuth, async (req, res) => {
  try {
    await Attendance.deleteOne({ employeeId: req.params.id, date: req.params.date })
    res.json({ message: 'Attendance cleared' })
  } catch {
    res.status(400).json({ error: 'Failed to clear attendance' })
  }
})

export default router
