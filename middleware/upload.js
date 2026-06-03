import multer from 'multer'
import fs from 'fs'

const uploadDir = './uploads'
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `./uploads/${Date.now()}`
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    cb(null, safe)
  },
})

const fileFilter = (req, file, cb) => cb(null, true)
export const maxUploadFileSizeMB = 50

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxUploadFileSizeMB * 1024 * 1024 },
})

// Use this in your route instead of upload.single()
// upload.fields([{ name: 'attachment', maxCount: 1 }, { name: 'project', maxCount: 1 }])
export const uploadFields = upload.fields([
  { name: 'attachment', maxCount: 1 },
  { name: 'project',    maxCount: 1 },
])

export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: `Each uploaded file must be ${maxUploadFileSizeMB} MB or smaller.`,
    })
  }

  if (err) {
    return res.status(400).json({ error: err.message || 'File upload failed' })
  }

  next()
}
