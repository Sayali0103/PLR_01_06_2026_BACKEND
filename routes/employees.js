import express from 'express'
import bcrypt from 'bcryptjs'
import Employee from '../models/Employee.js'
import Attendance from '../models/Attendance.js'
import LeaveRequest from '../models/LeaveRequest.js'
import SalarySlip from '../models/SalarySlip.js'
import WorkTask from '../models/WorkTask.js'
import { adminAuth, createEmployeeToken, employeeAuth, employeeManager, hrOrAdmin } from '../middleware/auth.js'
import { submissionRateLimit } from '../middleware/submissionRateLimit.js'
import { receiveSalarySlip } from '../middleware/salarySlipUpload.js'

const router = express.Router()
const START_DATE = '2026-09-01'

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

router.post('/login', submissionRateLimit, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const password = String(req.body.password || '')
    const workMode = String(req.body.workMode || 'office')
    if (!name || !password) return res.status(400).json({ error: 'Name and password are required' })
    if (!['office', 'wfh'].includes(workMode)) return res.status(400).json({ error: 'Choose office or WFH' })
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = await Employee.find({ name: new RegExp(`^${escapedName}$`, 'i'), isActive: true, portalEnabled: true }).select('+passwordHash')
    if (matches.length > 1) return res.status(400).json({ error: 'More than one employee has this name. Please contact HR.' })
    const employee = matches[0]
    if (!employee?.passwordHash || !(await bcrypt.compare(password, employee.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect name or password' })
    }
    const date = todayInIndia()
    await Attendance.findOneAndUpdate(
      { employeeId: employee._id, date },
      {
        $set: { workMode, status: workMode === 'wfh' ? 'wfh' : 'present', loginAt: new Date() },
        $unset: { logoutAt: 1 },
        $setOnInsert: { employeeId: employee._id, date },
      },
      { upsert: true, new: true, runValidators: true }
    )
    res.json({ token: createEmployeeToken(employee._id), employee: { _id: employee._id, name: employee.name, email: employee.email } })
  } catch {
    res.status(500).json({ error: 'Unable to sign in' })
  }
})

router.get('/me', employeeAuth, async (req, res) => {
  try {
    const [attendance, leaveRequests, salarySlips, tasks] = await Promise.all([
      Attendance.find({ employeeId: req.employee._id }).sort({ date: 1 }),
      LeaveRequest.find({ employeeId: req.employee._id }).sort({ createdAt: -1 }),
      SalarySlip.find({ employeeId: req.employee._id }).select('month originalName createdAt').sort({ month: -1 }),
      WorkTask.find({ employeeId: req.employee._id }).sort({ createdAt: -1 }),
    ])
    res.json({ employee: req.employee, attendance, leaveRequests, salarySlips, tasks })
  } catch {
    res.status(500).json({ error: 'Unable to load employee dashboard' })
  }
})

router.get('/me/salary-slips/:id/file', employeeAuth, async (req, res) => {
  try {
    const slip = await SalarySlip.findOne({ _id: req.params.id, employeeId: req.employee._id }).select('+data')
    if (!slip) return res.status(404).json({ error: 'Salary slip not found' })
    res.set({ 'Content-Type': slip.contentType, 'Content-Disposition': `attachment; filename="${slip.month}-salary-slip.pdf"`, 'Cache-Control': 'private, no-store' })
    res.send(slip.data)
  } catch {
    res.status(404).json({ error: 'Salary slip not found' })
  }
})

router.post('/me/logout', employeeAuth, async (req, res) => {
  try {
    const attendance = await Attendance.findOneAndUpdate(
      { employeeId: req.employee._id, loginAt: { $exists: true }, logoutAt: { $exists: false } },
      { $set: { logoutAt: new Date() } },
      { new: true, sort: { date: -1 } }
    )
    res.json({ message: 'Signed out', attendance })
  } catch {
    res.status(500).json({ error: 'Unable to record sign out time' })
  }
})

router.put('/me/tasks/:id', employeeAuth, async (req, res) => {
  const { status } = req.body
  const updateNote = String(req.body.updateNote || '').trim()
  if (!['assigned', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Choose assigned, in progress, or completed' })
  }
  if (updateNote.length > 1000) return res.status(400).json({ error: 'Task updates must be 1000 characters or fewer' })
  try {
    const task = await WorkTask.findOneAndUpdate(
      { _id: req.params.id, employeeId: req.employee._id },
      { status, updateNote, employeeUpdatedAt: new Date() },
      { new: true, runValidators: true }
    )
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  } catch {
    res.status(400).json({ error: 'Unable to update task' })
  }
})

router.get('/attendance-summary', adminAuth, async (req, res) => {
  const month = String(req.query.month || '')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'Select a valid month' })
  try {
    const startDate = `${month}-01`
    const endDate = `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate().toString().padStart(2, '0')}`
    const [employees, records, approvedLeaves] = await Promise.all([
      Employee.find().select('name email isActive').sort({ name: 1 }),
      Attendance.find({ date: { $gte: startDate, $lte: endDate } }).select('employeeId date status workMode loginAt logoutAt'),
      LeaveRequest.find({ status: 'approved', startDate: { $lte: endDate }, endDate: { $gte: startDate } }).select('employeeId startDate endDate'),
    ])
    const summaries = employees.map(employee => {
      const employeeRecords = records.filter(record => String(record.employeeId) === String(employee._id))
      const employeeLeaves = approvedLeaves.filter(request => String(request.employeeId) === String(employee._id))
      const leaveDays = new Set()
      employeeLeaves.forEach(request => {
        const from = request.startDate < startDate ? startDate : request.startDate
        const through = request.endDate > endDate ? endDate : request.endDate
        for (let date = from; date <= through; date = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)) {
          leaveDays.add(date)
        }
      })
      const attendanceByDate = new Map(employeeRecords.map(record => [record.date, record]))
      const leaveCount = [...leaveDays].filter(date => !attendanceByDate.has(date) || attendanceByDate.get(date).status === 'absent').length
      return {
        employee: { _id: employee._id, name: employee.name, email: employee.email, isActive: employee.isActive },
        working: employeeRecords.reduce((total, record) => total + (record.status === 'half_day' ? 0.5 : ['present', 'wfh'].includes(record.status) ? 1 : 0), 0),
        leave: leaveCount,
        absent: employeeRecords.filter(record => record.status === 'absent' && !leaveDays.has(record.date)).length,
        attendance: employeeRecords.sort((a, b) => a.date.localeCompare(b.date)),
      }
    })
    res.json({ month, employees: summaries })
  } catch {
    res.status(500).json({ error: 'Unable to load monthly attendance summary' })
  }
})

router.get('/tasks', adminAuth, async (_req, res) => {
  try {
    const tasks = await WorkTask.find().populate('employeeId', 'name email').sort({ createdAt: -1 })
    res.json(tasks)
  } catch {
    res.status(500).json({ error: 'Unable to load employee tasks' })
  }
})

router.post('/tasks', adminAuth, async (req, res) => {
  const employeeId = String(req.body.employeeId || '')
  const title = String(req.body.title || '').trim()
  const description = String(req.body.description || '').trim()
  const dueDate = String(req.body.dueDate || '')
  if (!/^[a-f\d]{24}$/i.test(employeeId)) return res.status(400).json({ error: 'Select a valid employee' })
  if (!title || title.length > 160) return res.status(400).json({ error: 'Enter a task title up to 160 characters' })
  if (description.length > 2000) return res.status(400).json({ error: 'Task description must be 2000 characters or fewer' })
  if (dueDate && !validDate(dueDate)) return res.status(400).json({ error: 'Enter a valid due date' })
  try {
    const employee = await Employee.findOne({ _id: employeeId, isActive: true })
    if (!employee) return res.status(404).json({ error: 'Active employee not found' })
    const task = await WorkTask.create({ employeeId, title, description, dueDate: dueDate || undefined })
    await task.populate('employeeId', 'name email')
    res.status(201).json(task)
  } catch {
    res.status(400).json({ error: 'Unable to assign task' })
  }
})

router.post('/salary-slips', adminAuth, hrOrAdmin, receiveSalarySlip, async (req, res) => {
  const employeeId = String(req.body.employeeId || '')
  const month = String(req.body.month || '')
  if (!/^[a-f\d]{24}$/i.test(employeeId)) return res.status(400).json({ error: 'Select a valid employee' })
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'Select a valid month' })
  const file = req.file
  if (!file) return res.status(400).json({ error: 'Choose a salary slip PDF' })
  if (file.mimetype !== 'application/pdf' || !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return res.status(400).json({ error: 'Salary slips must be PDF files' })
  }
  try {
    const employee = await Employee.findOne({ _id: employeeId, isActive: true })
    if (!employee) return res.status(404).json({ error: 'Active employee not found' })
    const slip = await SalarySlip.findOneAndUpdate(
      { employeeId, month },
      { employeeId, month, originalName: file.originalname.replace(/[\\/\r\n\0]/g, '_').slice(0, 200) || `${month}-salary-slip.pdf`, contentType: 'application/pdf', data: file.buffer },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).select('month originalName createdAt')
    res.status(201).json(slip)
  } catch {
    res.status(400).json({ error: 'Unable to save salary slip' })
  }
})

router.get('/:id/salary-slips', adminAuth, hrOrAdmin, async (req, res) => {
  try {
    const slips = await SalarySlip.find({ employeeId: req.params.id }).select('month originalName createdAt').sort({ month: -1 })
    res.json(slips)
  } catch {
    res.status(400).json({ error: 'Unable to load salary slips' })
  }
})

router.get('/:id/salary-slips/:slipId/file', adminAuth, hrOrAdmin, async (req, res) => {
  try {
    const slip = await SalarySlip.findOne({ _id: req.params.slipId, employeeId: req.params.id }).select('+data')
    if (!slip) return res.status(404).json({ error: 'Salary slip not found' })
    res.set({ 'Content-Type': slip.contentType, 'Content-Disposition': `attachment; filename="${slip.month}-salary-slip.pdf"`, 'Cache-Control': 'private, no-store' })
    res.send(slip.data)
  } catch {
    res.status(404).json({ error: 'Salary slip not found' })
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

router.put('/leave-requests/:id', adminAuth, hrOrAdmin, async (req, res) => {
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

router.put('/:id/attendance/:date', adminAuth, hrOrAdmin, async (req, res) => {
  const { date } = req.params
  const { status } = req.body
  if (!validDate(date) || date < START_DATE) {
    return res.status(400).json({ error: 'Attendance can only be marked from 1 September 2026 onward' })
  }
  if (!['present', 'absent', 'holiday', 'half_day', 'wfh'].includes(status)) {
    return res.status(400).json({ error: 'Choose present, absent, holiday, half day, or WFH' })
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

router.delete('/:id/attendance/:date', adminAuth, hrOrAdmin, async (req, res) => {
  try {
    await Attendance.deleteOne({ employeeId: req.params.id, date: req.params.date })
    res.json({ message: 'Attendance cleared' })
  } catch {
    res.status(400).json({ error: 'Failed to clear attendance' })
  }
})

export default router
