import fs from 'fs'
import { google } from 'googleapis'

async function getDrive() {
  const {
    GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET,
    GOOGLE_DRIVE_REFRESH_TOKEN,
  } = process.env

  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error('Google Drive OAuth env values are missing')
  }

  const auth = new google.auth.OAuth2(
    GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN })

  return google.drive({ version: 'v3', auth })
}

function folderIdForType(type) {
  if (type === 'resume') return process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID
  if (type === 'project') return process.env.GOOGLE_DRIVE_PROJECT_FOLDER_ID
  return ''
}

export async function uploadApplicationFileToDrive(file, type) {
  if (!file) return null

  const folderId = folderIdForType(type)
  if (!folderId) {
    throw new Error(`Missing Google Drive folder ID for ${type} uploads`)
  }

  const drive = await getDrive()
  const response = await drive.files.create({
    requestBody: {
      name: file.filename,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.path),
    },
    supportsAllDrives: true,
    fields: 'id,name,mimeType,size,webViewLink,webContentLink',
  })

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    size: response.data.size,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
  }
}

export async function removeLocalUpload(file) {
  if (!file?.path) return

  try {
    await fs.promises.unlink(file.path)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Temporary upload cleanup failed:', err.message)
    }
  }
}
