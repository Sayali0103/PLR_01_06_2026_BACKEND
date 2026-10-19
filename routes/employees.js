import express from 'express'
import bcrypt from 'bcryptjs'
import Employee from '../models/Employee.js'
import Attendance from '../models/Attendance.js'
import LeaveRequest from '../models/LeaveRequest.js'
import { adminAuth, createEmployeeToken, employeeAuth, employeeManager, hrOnly } from '../middleware/auth.js'
import { submissionRateLimit } from '../middleware/submissionRateLimit.js'

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

router.post('/login', submissionRateLimit, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const password = String(req.body.password || '')
    if (!name || !password) return res.status(400).json({ error: 'Name and password are required' })
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = await Employee.find({ name: new RegExp(`^${escapedName}$`, 'i'), isActive: true, portalEnabled: true }).select('+passwordHash')
    if (matches.length > 1) return res.status(400).json({ error: 'More than one employee has this name. Please contact HR.' })
    const employee = matches[0]
    if (!employee?.passwordHash || !(await bcrypt.compare(password, employee.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect name or password' })
    }
    res.json({ token: createEmployeeToken(employee._id), employee: { _id: employee._id, name: employee.name, email: employee.email } })
  } catch {
    res.status(500).json({ error: 'Unable to sign in' })
  }
})

router.get('/me', employeeAuth, async (req, res) => {
  try {
    const [attendance, leaveRequests] = await Promise.all([
      Attendance.find({ employeeId: req.employee._id }).sort({ date: 1 }),
      LeaveRequest.find({ employeeId: req.employee._id }).sort({ createdAt: -1 }),
    ])
    res.json({ employee: req.employee, attendance, leaveRequests })
  } catch {
    res.status(500).json({ error: 'Unable to load employee dashboard' })
  }
})

router.post('/me/leaves', employeeAuth, async (req, res) => {
  const startDate = String(req.body.startDate || '')
  const endDate = String(req.body.endDate || '')
  const reason = String(req.body.reason || '').trim()
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) {
    return res.status(400).json({ error: 'Enter a valid date range' })
  }
  if (startDate < START_DATE) return res.status(400).json({ error: 'Leave dates must be from 1 September 2026 onward' })
  if (!reason || reason.length > 1000) return res.status(400).json({ error: 'Please enter a reason (up to 1000 characters)' })
  try {
    const leaveRequest = await LeaveRequest.create({ employeeId: req.employee._id, startDate, endDate, reason })
    res.status(201).json(leaveRequest)
  } catch {
    res.status(400).json({ error: 'Unable to submit leave request' })
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

router.get('/leave-requests', adminAuth, async (_req, res) => {
  try {
    const requests = await LeaveRequest.find().populate('employeeId', 'name email').sort({ createdAt: -1 })
    res.json(requests)
  } catch {
    res.status(500).json({ error: 'Unable to fetch leave requests' })
  }
})

router.put('/leave-requests/:id', adminAuth, hrOnly, async (req, res) => {
  const { status } = req.body
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' })
  try {
    const leaveRequest = await LeaveRequest.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).populate('employeeId', 'name email')
    if (!leaveRequest) return res.status(404).json({ error: 'Leave request not found' })
    res.json(leaveRequest)
  } catch {
    res.status(400).json({ error: 'Unable to update leave request' })
  }
})

router.post('/', adminAuth, employeeManager, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' })
    const initialPassword = String(req.body.password || '')
    if (initialPassword.length < 8) return res.status(400).json({ error: 'Initial password must be at least 8 characters' })
    const passwordHash = await bcrypt.hash(initialPassword, 12)
    const employee = await Employee.create({ name, email, passwordHash, portalEnabled: true })
    res.status(201).json(employee)
  } catch (err) {
    res.status(400).json({ error: err.code === 11000 ? 'An employee with this email already exists' : err.message })
  }
})

router.put('/:id/portal', adminAuth, employeeManager, async (req, res) => {
  const password = String(req.body.password || '')
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { passwordHash: await bcrypt.hash(password, 12), portalEnabled: true, isActive: true },
      { new: true, runValidators: true }
    )
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    res.json(employee)
  } catch {
    res.status(400).json({ error: 'Unable to enable employee portal' })
  }
})

router.delete('/:id', adminAuth, employeeManager, async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, { isActive: false, portalEnabled: false }, { new: true })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    res.json({ message: 'Employee removed' })
  } catch {
    res.status(400).json({ error: 'Failed to remove employee' })
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

router.put('/:id/attendance/:date', adminAuth, hrOnly, async (req, res) => {
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

router.delete('/:id/attendance/:date', adminAuth, hrOnly, async (req, res) => {
  try {
    await Attendance.deleteOne({ employeeId: req.params.id, date: req.params.date })
    res.json({ message: 'Attendance cleared' })
  } catch {
    res.status(400).json({ error: 'Failed to clear attendance' })
  }
})

export default router
