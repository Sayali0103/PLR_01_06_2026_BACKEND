import dotenv from 'dotenv'
dotenv.config()

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
