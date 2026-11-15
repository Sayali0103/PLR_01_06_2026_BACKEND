import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import jobRoutes from './routes/jobs.js'
import applicationRoutes from './routes/applications.js'
import contactRoutes from './routes/contact.js'
import demoRequestRoutes from './routes/demoRequests.js'
import employeeRoutes from './routes/employees.js'
import chatRoutes from './routes/chat.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

const frontendOrigins = new Set([
  'http://localhost:5173',
  'https://plrobotics.in',
  'https://www.plrobotics.in',
  ...(process.env.FRONTEND_ORIGIN || '').split(','),
].map(origin => origin.trim()).filter(Boolean))

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || frontendOrigins.has(origin)),
  credentials: true,
}))
app.use(express.json({ limit: '100kb' }))

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/jobs', jobRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/demo-requests', demoRequestRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/chat', chatRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected')
    const port = Number(process.env.PORT || 5001)
    const host = process.env.HOST || '0.0.0.0'
    app.listen(port, host, () =>
      console.log(`🚀 Server running at http://${host}:${port}`)
    )
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err)
    process.exit(1)
  })
