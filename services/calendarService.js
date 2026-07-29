import { google } from 'googleapis'

const TIME_ZONE = 'Asia/Kolkata'

function getCalendar() {
  const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN } = process.env
  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET || !GOOGLE_CALENDAR_REFRESH_TOKEN) {
    throw new Error('Google Calendar OAuth env values are missing')
  }

  const auth = new google.auth.OAuth2(GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN })
  return google.calendar({ version: 'v3', auth })
}

export async function createInterviewCalendarEvent({ application, interviewer, startAt, endAt }) {
  const calendar = getCalendar()
  const candidateName = [application.firstName, application.middleName, application.lastName].filter(Boolean).join(' ')
  const result = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: `PL Robotics interview — ${application.jobTitle}`,
      description: `Interview with ${candidateName} for the ${application.jobTitle} role. Assigned interviewer: ${interviewer.name}.`,
      start: { dateTime: startAt.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: endAt.toISOString(), timeZone: TIME_ZONE },
      attendees: [
        { email: application.email, displayName: candidateName },
        { email: interviewer.email, displayName: interviewer.name },
      ],
      conferenceData: {
        createRequest: { requestId: `plr-interview-${application._id}-${Date.now()}` },
      },
    },
  })

  const meetLink = result.data.hangoutLink || result.data.conferenceData?.entryPoints?.find(point => point.entryPointType === 'video')?.uri
  if (!meetLink) throw new Error(`Google Meet link was not created for ${candidateName}`)
  return { eventId: result.data.id, meetLink }
}

export async function deleteInterviewCalendarEvent(eventId) {
  if (!eventId) return
  const calendar = getCalendar()
  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    eventId,
    sendUpdates: 'all',
  })
}
