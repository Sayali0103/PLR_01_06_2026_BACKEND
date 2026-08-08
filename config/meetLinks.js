export const roleMeetLinks = {
  robotics: 'https://meet.google.com/vck-cqkr-yvd',
  mechanical: 'https://meet.google.com/mcq-zjio-qez',
  electronics: 'https://meet.google.com/pts-pxon-knm',
}

export function getRoleKey(jobTitle = '') {
  const normalized = String(jobTitle).toLowerCase()
  if (normalized.includes('robotics')) return 'robotics'
  if (normalized.includes('mechanical')) return 'mechanical'
  if (normalized.includes('electronics') || normalized.includes('electronic')) return 'electronics'
  return null
}

export function getRoleMeetLink(jobTitle = '') {
  const role = getRoleKey(jobTitle)
  return role ? roleMeetLinks[role] : null
}
