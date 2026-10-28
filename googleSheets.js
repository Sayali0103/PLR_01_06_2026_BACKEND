import { google } from 'googleapis'
import dotenv from 'dotenv'
dotenv.config()

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

const APPLICATION_HEADERS = [
  'Date',
  'First Name',
  'Middle Name',
  'Last Name',
  'Date of Birth',
  'Phone',
  'Email',
  'Current Location',
  'Currently Employed?',
  'Employer / Notice Period',
  'Job Title',
  'Application Type',
  'Resume File',
  'Project File',
  'Status',
  'ATS Score',
]

const CONTACT_HEADERS = [
  'Date',
  'First Name',
  'Last Name',
  'Phone',
  'Email',
  'Reason to Contact',
  'Status',
]

const DEMO_HEADERS = [
  'Date',
  'First Name',
  'Last Name',
  'Company Name',
  'Company Address',
  'Company Contact',
  'Interested Robot / Service',
  'Industry Type',
  'Application',
  'Status',
  'Company Email',
]

async function getSheet() {
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON
  const authOptions = { scopes: SCOPES }

  if (credentialsJson) {
    authOptions.credentials = JSON.parse(credentialsJson)
  } else {
    authOptions.keyFile =
      process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || process.env.GOOGLE_CREDENTIALS_PATH
  }

  const auth = new google.auth.GoogleAuth(authOptions)
  const client = await auth.getClient()
  return google.sheets({ version: 'v4', auth: client })
}

function formatDate(date) {
  return new Date(date || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

async function ensureTabWithHeaders(sheets, tabName, headers) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
  const tabExists = spreadsheet.data.sheets?.some(sheet => sheet.properties?.title === tabName)

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    })
  }

  const lastColumn = String.fromCharCode(64 + headers.length)
  const range = `'${tabName}'!A1:${lastColumn}1`
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  const existingHeaders = result.data.values?.[0] || []
  const canSafelyExtendHeaders =
    existingHeaders.length < headers.length &&
    existingHeaders.every((header, index) => header === headers[index])

  if (!existingHeaders.length || canSafelyExtendHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    })
  }
}

async function appendRow(tabName, headers, row) {
  const sheets = await getSheet()
  await ensureTabWithHeaders(sheets, tabName, headers)
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `'${tabName}'!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

function normalizeHeader(header) {
  return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getApplicationCellValue(header, application, hasTimestampColumn) {
  switch (normalizeHeader(header)) {
    case 'status':
      return 'New'
    case 'timestamp':
    case 'createdat':
    case 'datesubmitted':
    case 'applicationdate':
      return formatDate(application.createdAt)
    case 'date':
      return hasTimestampColumn ? application.dob : formatDate(application.createdAt)
    case 'dateofbirth':
    case 'dob':
      return application.dob
    case 'firstname':
      return application.firstName
    case 'middlename':
      return application.middleName || ''
    case 'lastname':
      return application.lastName
    case 'phone':
    case 'mobile':
    case 'mobilenumber':
      return application.phone
    case 'email':
    case 'emailid':
      return application.email
    case 'currentlocation':
      return application.currentLocation || ''
    case 'currentlyemployed':
      return application.currentlyEmployed ? 'Yes' : 'No'
    case 'employernoticeperiod':
    case 'employerdetails':
      return application.employerDetails || ''
    case 'jobtitle':
    case 'position':
      return application.jobTitle
    case 'applicationtype':
    case 'applicanttype':
      return application.applicantType === 'intern' ? 'Intern' : 'Full-time Employee'
    case 'resumefile':
    case 'resume':
      return application.attachmentDriveLink || application.attachmentFileName || ''
    case 'projectfile':
    case 'project':
      return application.projectDriveLink || application.projectFileName || ''
    case 'atsscore':
      return application.atsScore == null ? '' : `${application.atsScore.toFixed(1)}/10`
    default:
      return ''
  }
}

async function appendApplicationRow(application) {
  const sheets = await getSheet()
  await ensureTabWithHeaders(sheets, 'Applications', APPLICATION_HEADERS)

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "'Applications'!A1:ZZ1",
  })
  const sheetHeaders = result.data.values?.[0] || APPLICATION_HEADERS
  const hasTimestampColumn = sheetHeaders.some(header => normalizeHeader(header) === 'timestamp')
  const row = sheetHeaders.map(header => getApplicationCellValue(header, application, hasTimestampColumn))

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "'Applications'!A1",
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

export async function ensureInquiryTabs() {
  const sheets = await getSheet()
  await ensureTabWithHeaders(sheets, 'Contact Enquiries', CONTACT_HEADERS)
  await ensureTabWithHeaders(sheets, 'Demo Requests', DEMO_HEADERS)
}

export async function ensureApplicationTab() {
  const sheets = await getSheet()
  await ensureTabWithHeaders(sheets, 'Applications', APPLICATION_HEADERS)
}

export async function appendApplicationToSheet(application) {
  try {
    await appendApplicationRow(application)
    console.log(`Application sheet updated - ${application.firstName} ${application.lastName}`)
  } catch (err) {
    console.error('Google Sheets application append failed:', err.message)
  }
}

export async function appendContactInquiryToSheet(inquiry) {
  await appendRow('Contact Enquiries', CONTACT_HEADERS, [
    formatDate(inquiry.createdAt),
    inquiry.firstName,
    inquiry.lastName,
    inquiry.phone,
    inquiry.email,
    inquiry.reason,
    'New',
  ])
  console.log(`Contact sheet updated - ${inquiry.firstName} ${inquiry.lastName}`)
}

export async function appendDemoRequestToSheet(request) {
  await appendRow('Demo Requests', DEMO_HEADERS, [
    formatDate(request.createdAt),
    request.firstName,
    request.lastName,
    request.companyName,
    request.companyAddress,
    request.companyContact,
    request.interestedIn,
    request.industryType,
    request.application,
    'New',
    request.companyEmail,
  ])
  console.log(`Demo request sheet updated - ${request.firstName} ${request.lastName}`)
}
