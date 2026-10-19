import dotenv from 'dotenv'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import Employee from '../models/Employee.js'
dotenv.config()

const defaultEmployeeSecret = randomBytes(32).toString('hex')
const employeeSecret = () => process.env.EMPLOYEE_SESSION_SECRET || defaultEmployeeSecret

export function createEmployeeToken(employeeId) {
  const payload = Buffer.from(JSON.stringify({ id: String(employeeId), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url')
  const signature = createHmac('sha256', employeeSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export async function employeeAuth(req, res, next) {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const [payload, suppliedSignature] = token.split('.')
    if (!payload || !suppliedSignature) return res.status(401).json({ error: 'Please sign in to continue' })
    const expectedSignature = createHmac('sha256', employeeSecret()).update(payload).digest()
    const actualSignature = Buffer.from(suppliedSignature, 'base64url')
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
      return res.status(401).json({ error: 'Invalid employee session' })
    }
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!session.id || session.exp < Date.now()) return res.status(401).json({ error: 'Employee session expired' })
    const employee = await Employee.findOne({ _id: session.id, isActive: true, portalEnabled: true }).select('name email')
    if (!employee) return res.status(401).json({ error: 'Employee portal is unavailable' })
    req.employee = employee
    next()
  } catch {
    res.status(401).json({ error: 'Invalid employee session' })
  }
}

export const adminAuth = (req, res, next) => {
  const password = req.headers['x-admin-password']
  const role = req.headers['x-admin-role']
  const passwords = {
    admin: process.env.ADMIN_PASSWORD || 'admin123',
    hr: process.env.HR_PASSWORD || 'hr123',
  }
  if (!password || !['admin', 'hr'].includes(role) || password !== passwords[role]) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.adminRole = role
  next()
}

export const adminOnly = (req, res, next) => {
  if (req.adminRole !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

export const hrOnly = (req, res, next) => {
  if (req.adminRole !== 'hr') return res.status(403).json({ error: 'HR access required' })
  next()
}

export const employeeManager = (req, res, next) => {
  if (!['hr', 'admin'].includes(req.adminRole)) return res.status(403).json({ error: 'Admin or HR access required' })
  next()
}
