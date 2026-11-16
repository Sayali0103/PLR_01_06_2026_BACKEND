import path from 'path'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
const OFFICE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])

const documentTypes = {
  '.pdf': { contentType: 'application/pdf', validMimeTypes: ['application/pdf'], signature: Buffer.from('%PDF-') },
  '.doc': { contentType: 'application/msword', validMimeTypes: ['application/msword'], signature: OFFICE_SIGNATURE },
  '.xls': { contentType: 'application/vnd.ms-excel', validMimeTypes: ['application/vnd.ms-excel'], signature: OFFICE_SIGNATURE },
  '.ppt': { contentType: 'application/vnd.ms-powerpoint', validMimeTypes: ['application/vnd.ms-powerpoint'], signature: OFFICE_SIGNATURE },
  '.docx': { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', validMimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'], signature: ZIP_SIGNATURE },
  '.xlsx': { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validMimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'], signature: ZIP_SIGNATURE },
  '.pptx': { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', validMimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'], signature: ZIP_SIGNATURE },
  '.jpg': { contentType: 'image/jpeg', validMimeTypes: ['image/jpeg'], signature: Buffer.from([0xff, 0xd8, 0xff]) },
  '.jpeg': { contentType: 'image/jpeg', validMimeTypes: ['image/jpeg'], signature: Buffer.from([0xff, 0xd8, 0xff]) },
  '.png': { contentType: 'image/png', validMimeTypes: ['image/png'], signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
}

export function receiveEmployeeDocument(req, res, next) {
  upload.single('document')(req, res, err => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Employee documents must be 10 MB or smaller' })
    }
    if (err) return res.status(400).json({ error: 'Unable to upload employee document' })
    next()
  })
}

export function inspectEmployeeDocument(file) {
  if (!file) return null
  const extension = path.extname(file.originalname).toLowerCase()
  const type = documentTypes[extension]
  if (!type || !type.validMimeTypes.includes(file.mimetype) || !file.buffer.subarray(0, type.signature.length).equals(type.signature)) {
    return null
  }
  return type.contentType
}
