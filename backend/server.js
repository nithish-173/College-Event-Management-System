import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const scrypt = promisify(scryptCallback)
const dataDirectory = join(dirname(fileURLToPath(import.meta.url)), 'data')
const databasePath = join(dataDirectory, 'store.json')
const secretPath = join(dataDirectory, 'session-secret')
const port = Number(process.env.API_PORT || process.env.PORT || 3001)

const seedEvents = [
  {
    id: randomUUID(),
    title: 'Tech Fest 2026',
    date: '12 Oct 2026',
    time: '09:00 AM - 05:00 PM',
    startDate: '2026-10-12',
    endDate: '2026-10-12',
    startTime: '09:00',
    endTime: '17:00',
    registrationDeadline: '2026-10-11',
    location: 'Main Auditorium',
    type: 'Academic',
    badge: 'Popular',
  },
  {
    id: randomUUID(),
    title: 'Cultural Night',
    date: '18 Oct 2026',
    time: '06:30 PM - 10:00 PM',
    startDate: '2026-10-18',
    endDate: '2026-10-18',
    startTime: '18:30',
    endTime: '22:00',
    registrationDeadline: '2026-10-17',
    location: 'Open Stage',
    type: 'Arts',
    badge: 'Featured',
  },
  {
    id: randomUUID(),
    title: 'Startup Pitch',
    date: '22 Oct 2026',
    time: '11:00 AM - 03:00 PM',
    startDate: '2026-10-22',
    endDate: '2026-10-22',
    startTime: '11:00',
    endTime: '15:00',
    registrationDeadline: '2026-10-20',
    location: 'Innovation Hub',
    type: 'Business',
    badge: 'New',
  },
]

let database
let sessionSecret
let writeQueue = Promise.resolve()

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64)
  return `${salt}:${hash.toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(':')
  if (!salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function createSampleRegistrations(events) {
  const techFest = events.find((event) => event.title === 'Tech Fest 2026')
  const culturalNight = events.find((event) => event.title === 'Cultural Night')
  if (!techFest || !culturalNight) return []
  const createdAt = new Date().toISOString()
  return [
    {
      id: randomUUID(), eventId: techFest.id, event: techFest.title, userId: 'sample-student-1',
      name: 'Aarav Sharma', email: 'aarav@example.edu', team: 'Byte Builders', teamMembers: 3,
      teamMemberNames: 'Aarav Sharma\nMeera Nair\nRohan Iyer', degree: 'B.Tech', batch: 'CSE',
      collegeType: 'Inter-college', collegeName: 'Riverdale College of Engineering', status: 'Confirmed', createdAt,
    },
    {
      id: randomUUID(), eventId: culturalNight.id, event: culturalNight.title, userId: 'sample-student-2',
      name: 'Nisha Patel', email: 'nisha@example.edu', team: 'Rhythm Collective', teamMembers: 2,
      teamMemberNames: 'Nisha Patel\nLeah Thomas', degree: 'B.E', batch: 'AIDS',
      collegeType: 'Inter-college', collegeName: 'Riverdale College of Engineering', status: 'Pending', createdAt,
    },
    {
      id: randomUUID(), eventId: techFest.id, event: techFest.title, userId: 'sample-student-3',
      name: 'Karan Malhotra', email: 'karan@example.edu', team: 'Launchpad', teamMembers: 2,
      teamMemberNames: 'Karan Malhotra\nPriya Verma', degree: 'MBA', batch: 'Business',
      collegeType: 'Outer-college', collegeName: 'Northshore Institute of Technology', status: 'Approved', createdAt,
    },
    {
      id: randomUUID(), eventId: culturalNight.id, event: culturalNight.title, userId: 'sample-student-4',
      name: 'Aditya Singh', email: 'aditya@example.edu', team: 'StageCraft', teamMembers: 1,
      teamMemberNames: 'Aditya Singh', degree: 'B.A', batch: 'Arts',
      collegeType: 'Outer-college', collegeName: 'Lakeside Arts and Media College', status: 'Pending', createdAt,
    },
  ]
}

async function initializeDatabase() {
  await mkdir(dataDirectory, { recursive: true })
  try {
    sessionSecret = await readFile(secretPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    sessionSecret = randomBytes(32)
    await writeFile(secretPath, sessionSecret, { mode: 0o600, flag: 'wx' }).catch(async (writeError) => {
      if (writeError.code !== 'EEXIST') throw writeError
      sessionSecret = await readFile(secretPath)
    })
  }

  try {
    database = JSON.parse(await readFile(databasePath, 'utf8'))
    if (!Array.isArray(database.accounts) || !Array.isArray(database.events) || !Array.isArray(database.registrations)) {
      throw new Error('Database file has an invalid shape.')
    }
    if ((database.schemaVersion || 0) < 2) {
      database.events = database.events.map((event) => {
        const seed = seedEvents.find((entry) => entry.title === event.title)
        if (!seed) return event
        return {
          ...seed,
          ...event,
          ...Object.fromEntries(Object.entries(seed).filter(([key]) => !(key in event))),
          time: event.time?.includes(' - ') ? event.time : seed.time,
        }
      })
      database.schemaVersion = 2
      await persistDatabase()
    }
    if ((database.schemaVersion || 0) < 3) {
      database.registrations = database.registrations.map((registration) => ({
        ...registration,
        team: registration.team || 'Individual',
        teamMembers: Number(registration.teamMembers) || 1,
        teamMemberNames: registration.teamMemberNames || registration.name,
        collegeType: registration.collegeType === 'Outer-college' ? 'Outer-college' : 'Inter-college',
        collegeName: registration.collegeName || 'Riverdale College of Engineering',
      }))
      const seededEmails = new Set(database.registrations.map((registration) => registration.email))
      database.registrations.push(...createSampleRegistrations(database.events)
        .filter((registration) => !seededEmails.has(registration.email)))
      database.schemaVersion = 3
      await persistDatabase()
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    database = {
      schemaVersion: 3,
      accounts: [
        {
          id: randomUUID(),
          name: 'Student Demo',
          email: 'student@college.edu',
          role: 'student',
          passwordHash: await hashPassword('student123'),
        },
        {
          id: randomUUID(),
          name: 'Staff Demo',
          email: 'staff@college.edu',
          role: 'staff',
          passwordHash: await hashPassword('staff123'),
        },
      ],
      events: seedEvents,
      registrations: createSampleRegistrations(seedEvents),
    }
    await persistDatabase()
  }
}

function persistDatabase() {
  writeQueue = writeQueue.then(async () => {
    const temporaryPath = `${databasePath}.tmp`
    await writeFile(temporaryPath, JSON.stringify(database, null, 2), 'utf8')
    await rename(temporaryPath, databasePath)
  })
  return writeQueue
}

function publicUser(account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    department: account.department || '',
    collegeName: account.collegeName || '',
    phone: account.phone || '',
  }
}

function createToken(account) {
  const payload = Buffer.from(JSON.stringify({
    sub: account.id,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })).toString('base64url')
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function authenticate(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw new ApiError(401, 'Please log in to continue.')

  const [payload, signature] = token.split('.')
  if (!payload || !signature) throw new ApiError(401, 'Your session is invalid. Please log in again.')

  const expectedSignature = createHmac('sha256', sessionSecret).update(payload).digest()
  let actualSignature
  try {
    actualSignature = Buffer.from(signature, 'base64url')
  } catch {
    throw new ApiError(401, 'Your session is invalid. Please log in again.')
  }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new ApiError(401, 'Your session is invalid. Please log in again.')
  }

  let claims
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new ApiError(401, 'Your session is invalid. Please log in again.')
  }
  if (!claims.sub || claims.exp <= Date.now()) throw new ApiError(401, 'Your session has expired. Please log in again.')

  const account = database.accounts.find((entry) => entry.id === claims.sub)
  if (!account) throw new ApiError(401, 'Your account is no longer available.')
  return account
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 64 * 1024) throw new ApiError(413, 'Request body is too large.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.')
  }
}

function send(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  })
  response.end(JSON.stringify(payload))
}

function requireRole(account, role) {
  if (account.role !== role) throw new ApiError(403, `Only ${role} accounts can perform this action.`)
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function validateEvent(input) {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const startDate = input.startDate
  const endDate = input.endDate
  const startTime = input.startTime
  const endTime = input.endTime
  if (!title || title.length > 120) throw new ApiError(400, 'Event name is required and must be under 120 characters.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')) {
    throw new ApiError(400, 'Enter a valid event start and end date.')
  }
  if (endDate < startDate) throw new ApiError(400, 'Event end date cannot be before its start date.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime || '')) {
    throw new ApiError(400, 'Enter a valid event start and end time.')
  }
  if (endDate === startDate && endTime <= startTime) throw new ApiError(400, 'Event end time must be later than its start time.')
  const registrationDeadline = input.registrationDeadline || startDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registrationDeadline) || registrationDeadline > startDate) {
    throw new ApiError(400, 'Registration must close on a valid date on or before the event start date.')
  }
  return {
    id: randomUUID(),
    title,
    date: startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} to ${formatDate(endDate)}`,
    time: `${formatTime(startTime)} - ${formatTime(endTime)}`,
    startDate,
    endDate,
    startTime,
    endTime,
    registrationDeadline,
    location: 'Staff assigned venue',
    type: 'Custom',
    badge: 'New',
    createdAt: new Date().toISOString(),
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const method = request.method
  const path = url.pathname

  if (method === 'GET' && path === '/api/health') {
    send(response, 200, { status: 'ok' })
    return
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const input = await readJson(request)
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const password = typeof input.password === 'string' ? input.password : ''
    const role = input.role
    const account = database.accounts.find((entry) => entry.email === email && entry.role === role)
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new ApiError(401, `No ${role === 'staff' ? 'staff' : 'student'} account found with these credentials.`)
    }
    send(response, 200, { user: publicUser(account), token: createToken(account) })
    return
  }

  if (method === 'POST' && path === '/api/auth/signup') {
    const input = await readJson(request)
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const password = typeof input.password === 'string' ? input.password : ''
    if (!name || name.length > 100) throw new ApiError(400, 'Name is required and must be under 100 characters.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Enter a valid email address.')
    if (password.length < 8 || password.length > 128) throw new ApiError(400, 'Password must be between 8 and 128 characters.')
    if (database.accounts.some((account) => account.email === email)) {
      throw new ApiError(409, 'An account with this email already exists.')
    }
    const account = {
      id: randomUUID(),
      name,
      email,
      role: 'student',
      passwordHash: await hashPassword(password),
    }
    database.accounts.push(account)
    await persistDatabase()
    send(response, 201, { user: publicUser(account), token: createToken(account) })
    return
  }

  const account = authenticate(request)
  if (method === 'GET' && path === '/api/auth/me') {
    send(response, 200, { user: publicUser(account) })
    return
  }
  if (method === 'PATCH' && path === '/api/profile') {
    const input = await readJson(request)
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name || name.length > 100) throw new ApiError(400, 'Name is required and must be under 100 characters.')
    account.name = name
    account.department = typeof input.department === 'string' ? input.department.trim().slice(0, 100) : ''
    account.collegeName = typeof input.collegeName === 'string' ? input.collegeName.trim().slice(0, 120) : ''
    account.phone = typeof input.phone === 'string' ? input.phone.trim().slice(0, 32) : ''
    await persistDatabase()
    send(response, 200, { user: publicUser(account) })
    return
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    send(response, 200, { message: 'Logged out.' })
    return
  }
  if (method === 'GET' && path === '/api/events') {
    send(response, 200, { events: [...database.events].sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || '')) })
    return
  }
  if (method === 'POST' && path === '/api/events') {
    requireRole(account, 'staff')
    const event = validateEvent(await readJson(request))
    database.events.unshift(event)
    await persistDatabase()
    send(response, 201, { event })
    return
  }
  if (method === 'GET' && path === '/api/registrations') {
    const registrations = account.role === 'staff'
      ? database.registrations
      : database.registrations.filter((entry) => entry.userId === account.id)
    send(response, 200, { registrations })
    return
  }
  if (method === 'POST' && path === '/api/registrations') {
    requireRole(account, 'student')
    const input = await readJson(request)
    const event = database.events.find((entry) => entry.id === input.eventId)
    if (!event) throw new ApiError(404, 'This event is no longer available.')
    if (event.registrationDeadline && event.registrationDeadline < new Date().toISOString().slice(0, 10)) {
      throw new ApiError(400, 'Registration for this event has closed.')
    }
    if (database.registrations.some((entry) => entry.eventId === event.id && entry.userId === account.id)) {
      throw new ApiError(409, 'You are already registered for this event.')
    }
    const studentName = typeof input.studentName === 'string' ? input.studentName.trim() : ''
    const teamName = typeof input.teamName === 'string' ? input.teamName.trim() : ''
    const teamMembers = Number(input.teamMembers)
    if (!studentName || studentName.length > 100) throw new ApiError(400, 'Enter a valid student name.')
    if (!Number.isInteger(teamMembers) || teamMembers < 1 || teamMembers > 20) {
      throw new ApiError(400, 'Team size must be between 1 and 20 members.')
    }
    const teamMemberNames = String(input.teamMemberNames || '').trim()
    const memberNames = teamMemberNames.split(/\r?\n/).filter((name) => name.trim())
    if (teamMembers > 1 && (!teamName || memberNames.length < teamMembers)) {
      throw new ApiError(400, 'Enter a team name and each team member name.')
    }
    const collegeType = input.collegeType === 'Outer-college' ? 'Outer-college' : 'Inter-college'
    const collegeName = typeof input.collegeName === 'string' ? input.collegeName.trim() : ''
    if (collegeType === 'Outer-college' && !collegeName) throw new ApiError(400, 'Enter your college name.')
    const registration = {
      id: randomUUID(),
      eventId: event.id,
      event: event.title,
      userId: account.id,
      name: studentName,
      email: account.email,
      team: teamName || 'Individual',
      teamMembers,
      teamMemberNames,
      memberAges: String(input.memberAges || '').trim(),
      memberEmails: String(input.memberEmails || '').trim(),
      degree: String(input.degree || ''),
      batch: String(input.batch || ''),
      collegeType,
      collegeName: collegeName || account.collegeName || 'Riverdale College of Engineering',
      status: 'Pending',
      createdAt: new Date().toISOString(),
    }
    database.registrations.push(registration)
    await persistDatabase()
    send(response, 201, { registration })
    return
  }
  if (method === 'PATCH' && path.startsWith('/api/registrations/')) {
    requireRole(account, 'staff')
    const id = path.slice('/api/registrations/'.length)
    const registration = database.registrations.find((entry) => entry.id === id)
    if (!registration) throw new ApiError(404, 'Registration not found.')
    const input = await readJson(request)
    if (!['Pending', 'Confirmed', 'Approved', 'Waitlist', 'Rejected'].includes(input.status)) {
      throw new ApiError(400, 'Choose a valid registration status.')
    }
    registration.status = input.status
    await persistDatabase()
    send(response, 200, { registration })
    return
  }

  throw new ApiError(404, 'API route not found.')
}

await initializeDatabase()
const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const status = error instanceof ApiError ? error.status : 500
    if (status >= 500) console.error(error)
    if (!response.headersSent) send(response, status, { error: status === 500 ? 'An unexpected server error occurred.' : error.message })
    else response.destroy()
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`College Event Portal API listening on http://localhost:${port}`)
})
