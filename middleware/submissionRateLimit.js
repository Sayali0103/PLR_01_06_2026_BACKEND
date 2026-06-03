const attempts = new Map()
const WINDOW_MS = 15 * 60 * 1000
const MAX_SUBMISSIONS = 10

export function submissionRateLimit(req, res, next) {
  const now = Date.now()
  const key = req.ip
  const recentAttempts = (attempts.get(key) || []).filter(timestamp => now - timestamp < WINDOW_MS)

  if (recentAttempts.length >= MAX_SUBMISSIONS) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' })
  }

  recentAttempts.push(now)
  attempts.set(key, recentAttempts)
  next()
}
