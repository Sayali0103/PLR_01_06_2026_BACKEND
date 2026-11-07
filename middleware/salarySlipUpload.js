import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } })

export function receiveSalarySlip(req, res, next) {
  upload.single('salarySlip')(req, res, err => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Salary slip must be 10 MB or smaller' })
    }
    if (err) return res.status(400).json({ error: 'Unable to upload salary slip' })
    next()
  })
}
