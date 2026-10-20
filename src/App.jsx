import { useEffect, useState } from 'react'
import { apiRequest, clearToken, hasToken, saveToken } from './api.js'
import './App.css'

const initialEventForm = {
  eventName: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  registrationDeadline: '',
}

const tasks = [
  'Finalize speaker lineup for Tech Fest',
  'Confirm media coverage for Cultural Night',
  'Review venue logistics and seating plan',
  'Send reminder emails to registered teams',
]

const quickActions = ['Create Event', 'Manage Teams', 'Send Updates', 'Track Budget']

const registrationUpdates = [
  { title: 'Registration opened', detail: '200 new student registrations received today.', tag: 'New' },
  { title: 'Verification pending', detail: '18 registration forms are awaiting approval.', tag: 'Pending' },
  { title: 'Fee reminder', detail: '25 students still need to confirm payment.', tag: 'Action' },
]

const eventLogs = [
  { time: '09:15 AM', action: 'Tech Fest venue checklist approved by admin', user: 'Aditi' },
  { time: '10:40 AM', action: 'Student registration link shared with all departments', user: 'Rohan' },
  { time: '01:05 PM', action: 'Cultural Night stage layout updated', user: 'Neha' },
  { time: '03:20 PM', action: 'Volunteer allocation report sent to staff', user: 'Suresh' },
]

const studentPortalLinks = ['Dashboard', 'Events', 'My Registrations', 'Calendar', 'Profile', 'Event Log']
const staffPortalLinks = ['Dashboard', 'Calendar', 'Student Updates', 'Inter College Students', 'Outer College Students', 'Registrations', 'Profile', 'Event Log', 'Budget']
const degreeOptions = ['B.E', 'B.Tech', 'M.E', 'M.Tech', 'PhD']
const batchOptions = ['CSE', 'AIDS', 'AIML', 'BIO-TECH', 'BIO-MED', 'CYBER SECURITY', 'VLSI']
const initialRegistrationForm = {
  studentName: '',
  teamName: '',
  teamMembers: '',
  teamMemberNames: '',
  memberAges: '',
  memberEmails: '',
  degree: 'B.Tech',
  batch: 'CSE',
  collegeType: 'Inter-college',
  collegeName: '',
}

const isPastDate = (date) => date < new Date().toISOString().slice(0, 10)

function App() {
  const [role, setRole] = useState('student')
  const [authMode, setAuthMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeSection, setActiveSection] = useState('Dashboard')
  const [showEventForm, setShowEventForm] = useState(false)
  const [newEvent, setNewEvent] = useState(initialEventForm)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [registrationForm, setRegistrationForm] = useState(initialRegistrationForm)
  const [profileForm, setProfileForm] = useState({ name: '', department: '', collegeName: '', phone: '' })
  const [notices, setNotices] = useState(registrationUpdates)
  const [pinnedReminder, setPinnedReminder] = useState(false)
  const [registrationFilter, setRegistrationFilter] = useState('All')

  useEffect(() => {
    if (!hasToken()) return
    apiRequest('/auth/me')
      .then(({ user: currentUser }) => {
        setUser(currentUser)
        setIsAuthenticated(true)
        return Promise.all([
          apiRequest('/events'),
          apiRequest('/registrations'),
        ])
      })
      .then(([eventData, registrationData]) => {
        setUpcomingEvents(eventData.events)
        setRegistrations(registrationData.registrations)
      })
      .catch((requestError) => {
        clearToken()
        setUser(null)
        setIsAuthenticated(false)
        setError(requestError.message)
      })
  }, [])

  const refreshPortalData = async () => {
    const [eventData, registrationData] = await Promise.all([
      apiRequest('/events'),
      apiRequest('/registrations'),
    ])
    setUpcomingEvents(eventData.events)
    setRegistrations(registrationData.registrations)
  }

  const handleRefresh = async () => {
    try {
      await refreshPortalData()
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPassword('')
    setError('')
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword || (authMode === 'signup' && !trimmedName)) {
      setError('Please fill in all required fields.')
      return
    }

    if (trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    try {
      const response = authMode === 'login'
        ? await apiRequest('/auth/login', {
          method: 'POST',
          body: { email: trimmedEmail, password: trimmedPassword, role },
        })
        : await apiRequest('/auth/signup', {
          method: 'POST',
          body: { name: trimmedName, email: trimmedEmail, password: trimmedPassword },
        })
      saveToken(response.token)
      setUser(response.user)
      setIsAuthenticated(true)
      setActiveSection('Dashboard')
      resetForm()
      await refreshPortalData()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleLogout = () => {
    clearToken()
    setUser(null)
    setIsAuthenticated(false)
    setUpcomingEvents([])
    setRegistrations([])
    setShowEventForm(false)
    setShowRegistrationForm(false)
    setSelectedEvent(null)
    setNewEvent(initialEventForm)
    setRegistrationForm(initialRegistrationForm)
    setActiveSection('Dashboard')
    resetForm()
  }

  const handleEventFormChange = (event) => {
    const { name, value } = event.target
    setNewEvent((currentEvent) => ({
      ...currentEvent,
      [name]: value,
    }))
  }

  const handleRegistrationChange = (event) => {
    const { name, value } = event.target
    setRegistrationForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleEventSelect = (event) => {
    if (event.registrationDeadline && isPastDate(event.registrationDeadline)) {
      setError('Registration for this event has closed.')
      return
    }
    setError('')
    setSelectedEvent(event)
    setRegistrationForm((currentForm) => ({
      ...currentForm,
      studentName: user?.name || '',
      collegeName: user?.collegeName || '',
    }))
    setShowRegistrationForm(true)
  }

  const handleNewEventSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = newEvent.eventName.trim()
    const hasRequiredFields = trimmedName && newEvent.startDate && newEvent.endDate && newEvent.startTime && newEvent.endTime && newEvent.registrationDeadline

    if (!hasRequiredFields) {
      setError('Please complete all event fields.')
      return
    }
    if (newEvent.endDate < newEvent.startDate) {
      setError('Event end date cannot be before its start date.')
      return
    }
    if (newEvent.endDate === newEvent.startDate && newEvent.endTime <= newEvent.startTime) {
      setError('Event end time must be later than its start time.')
      return
    }
    if (newEvent.registrationDeadline > newEvent.startDate) {
      setError('Registration must close on or before the event start date.')
      return
    }

    try {
      await apiRequest('/events', {
        method: 'POST',
        body: { ...newEvent, title: trimmedName },
      })
      await refreshPortalData()
      setNewEvent(initialEventForm)
      setShowEventForm(false)
      setError('')
      setActiveSection('Dashboard')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault()
    const memberCount = Number(registrationForm.teamMembers)
    const memberNames = registrationForm.teamMemberNames.split(/\r?\n/).filter((member) => member.trim())
    if (!registrationForm.studentName.trim() || !memberCount) {
      setError('Enter your name and team size before registering.')
      return
    }
    if (memberCount > 1 && (!registrationForm.teamName.trim() || memberNames.length < memberCount)) {
      setError('Enter a team name and each team member name.')
      return
    }
    try {
      await apiRequest('/registrations', {
        method: 'POST',
        body: { ...registrationForm, eventId: selectedEvent.id },
      })
      await refreshPortalData()
      setShowRegistrationForm(false)
      setSelectedEvent(null)
      setRegistrationForm(initialRegistrationForm)
      setError('')
      setActiveSection('Dashboard')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const openSection = (section) => {
    setError('')
    setShowEventForm(false)
    setShowRegistrationForm(false)
    setSelectedEvent(null)
    setActiveSection(section)
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    try {
      const { user: updatedUser } = await apiRequest('/profile', {
        method: 'PATCH',
        body: profileForm,
      })
      setUser(updatedUser)
      setActiveSection('Profile')
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const startProfileEdit = () => {
    setProfileForm({
      name: user?.name || '',
      department: user?.department || '',
      collegeName: user?.collegeName || '',
      phone: user?.phone || '',
    })
    openSection('Edit Profile')
  }

  const handleRegistrationStatus = async (registration, status) => {
    try {
      await apiRequest(`/registrations/${registration.id}`, {
        method: 'PATCH',
        body: { status },
      })
      await refreshPortalData()
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleQuickAction = (action) => {
    if (action === 'Create Event') {
      setError('')
      setShowEventForm(true)
    } else if (action === 'Manage Teams') {
      openSection('Registrations')
    } else if (action === 'Send Updates') {
      openSection('Student Updates')
    } else if (action === 'Track Budget') {
      openSection('Budget')
    }
  }

  const addNotice = () => {
    const detail = window.prompt('Write an update for students:')
    if (!detail?.trim()) return
    setNotices((current) => [
      { title: 'Staff announcement', detail: detail.trim(), tag: 'New' },
      ...current,
    ])
  }

  const exportRows = (filename, rows) => {
    if (rows.length === 0) {
      setError('There is no data to export yet.')
      return
    }
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`).join(',')),
    ].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const dashboardLinks = user?.role === 'staff' ? staffPortalLinks : studentPortalLinks
  const liveStats = [
    { label: 'Total Events', value: upcomingEvents.length, change: 'Available to your campus' },
    { label: 'Registrations', value: registrations.length, change: 'Submitted through the portal' },
    {
      label: 'Participants',
      value: registrations.reduce((total, registration) => total + registration.teamMembers, 0),
      change: 'Across all registered teams',
    },
    {
      label: 'Pending Review',
      value: registrations.filter((registration) => registration.status === 'Pending').length,
      change: 'Awaiting staff approval',
    },
  ]

  const renderEventCard = (event, canRegister = false) => {
    const registration = user?.role === 'student'
      ? registrations.find((entry) => entry.eventId === event.id)
      : null
    const registered = Boolean(registration)
    return (
      <article key={event.id} className={canRegister ? 'event-card event-card-interactive' : 'event-card'}>
        <div className="event-topline">
          <span className="type-pill">{event.type}</span>
          <span className="status-badge">{registered ? registration.status : event.badge || 'Open'}</span>
        </div>
        <h3>{event.title}</h3>
        <div className="event-meta">
          <span>{event.date}</span>
          <span>{event.time}</span>
        </div>
        <p>{event.location}</p>
        <p className="event-deadline">
          {event.registrationDeadline
            ? `Registration closes ${event.registrationDeadline}`
            : 'Registration is open'}
        </p>
        {user?.role === 'staff' && (
          <p className="event-deadline">
            {registrations.filter((entry) => entry.eventId === event.id).length} registered participant(s)
          </p>
        )}
        {canRegister && (
          <button
            type="button"
            className={registered ? 'logout-btn event-register-btn' : 'primary-btn event-register-btn'}
            disabled={registered}
            onClick={() => handleEventSelect(event)}
          >
            {registered ? 'Already registered' : 'Register for event'}
          </button>
        )}
      </article>
    )
  }

  const renderRegistrationTable = (records, showCollege) => (
    <div className="student-table-wrap">
      <table className="student-table">
        <thead>
          <tr>
            <th>Student / Team</th>
            <th>Team members</th>
            {showCollege && <th>College</th>}
            <th>Event</th>
            <th>Status</th>
            {user?.role === 'staff' && <th>Review</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((registration) => (
            <tr key={registration.id}>
              <td>
                <strong>{registration.name}</strong>
                <small className="table-secondary">{registration.team || 'Individual'} · {registration.degree} {registration.batch}</small>
              </td>
              <td>{registration.teamMemberNames || registration.name}</td>
              {showCollege && <td>{registration.collegeName || 'Riverdale College of Engineering'}</td>}
              <td>
                <strong>{registration.event}</strong>
                <small className="table-secondary">
                  {upcomingEvents.find((event) => event.id === registration.eventId)?.date || ''}
                  {' · '}
                  {upcomingEvents.find((event) => event.id === registration.eventId)?.time || ''}
                </small>
              </td>
              <td><span className={`status ${registration.status.toLowerCase().replace(/\s+/g, '-')}`}>{registration.status}</span></td>
              {user?.role === 'staff' && (
                <td className="review-actions">
                  <button type="button" className="small-btn" onClick={() => handleRegistrationStatus(registration, 'Approved')}>Approve</button>
                  <button type="button" className="small-btn" onClick={() => handleRegistrationStatus(registration, 'Waitlist')}>Waitlist</button>
                </td>
              )}
            </tr>
          ))}
          {records.length === 0 && (
            <tr><td colSpan={showCollege ? 6 : 5}>No registrations match this view yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  const renderDashboardBody = () => {
    if (user?.role === 'student' && showRegistrationForm) {
      return (
        <section className="panel registration-panel">
          <div className="panel-header">
            <h2>Event Registration</h2>
            <button type="button" className="small-btn" onClick={() => {
              setShowRegistrationForm(false)
              setError('')
            }}>
              Back
            </button>
          </div>

          <div className="registration-intro">
            <strong>{selectedEvent?.title}</strong>
            <span>{selectedEvent?.date} • {selectedEvent?.time}</span>
          </div>

          <form className="registration-form" onSubmit={handleRegistrationSubmit}>
            {error && <p className="error-message">{error}</p>}
            <div className="registration-grid">
              <label className="registration-field full">
                <span>Name</span>
                <input
                  type="text"
                  name="studentName"
                  value={registrationForm.studentName}
                  onChange={handleRegistrationChange}
                  placeholder="Enter your name"
                  required
                />
              </label>

              <label className="registration-field">
                <span>Team Name</span>
                <input
                  type="text"
                  name="teamName"
                  value={registrationForm.teamName}
                  onChange={handleRegistrationChange}
                  placeholder="Enter team name"
                  required={Number(registrationForm.teamMembers) > 1}
                />
              </label>

              <label className="registration-field">
                <span>Team Members</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  name="teamMembers"
                  value={registrationForm.teamMembers}
                  onChange={handleRegistrationChange}
                  placeholder="How many members"
                  required
                />
              </label>

              <label className="registration-field full">
                <span>Team Member Names</span>
                <textarea
                  name="teamMemberNames"
                  value={registrationForm.teamMemberNames}
                  onChange={handleRegistrationChange}
                  placeholder="Enter all team member names"
                  required={Number(registrationForm.teamMembers) > 1}
                />
              </label>

              <label className="registration-field full">
                <span>All Members Age</span>
                <textarea
                  name="memberAges"
                  value={registrationForm.memberAges}
                  onChange={handleRegistrationChange}
                  placeholder="Enter each member age on a new line"
                />
              </label>

              <label className="registration-field full">
                <span>All Members E-mail</span>
                <textarea
                  name="memberEmails"
                  value={registrationForm.memberEmails}
                  onChange={handleRegistrationChange}
                  placeholder="Enter each member email on a new line"
                />
              </label>

              <label className="registration-field">
                <span>Degree</span>
                <select name="degree" value={registrationForm.degree} onChange={handleRegistrationChange}>
                  {degreeOptions.map((degree) => (
                    <option key={degree} value={degree}>{degree}</option>
                  ))}
                </select>
              </label>

              <label className="registration-field">
                <span>Batch</span>
                <select name="batch" value={registrationForm.batch} onChange={handleRegistrationChange}>
                  {batchOptions.map((batch) => (
                    <option key={batch} value={batch}>{batch}</option>
                  ))}
                </select>
              </label>

              <label className="registration-field">
                <span>College participation</span>
                <select name="collegeType" value={registrationForm.collegeType} onChange={handleRegistrationChange}>
                  <option value="Inter-college">Inter-college student</option>
                  <option value="Outer-college">Outer-college student</option>
                </select>
              </label>
              {registrationForm.collegeType === 'Outer-college' && (
                <label className="registration-field">
                  <span>College name</span>
                  <input
                    type="text"
                    name="collegeName"
                    value={registrationForm.collegeName}
                    onChange={handleRegistrationChange}
                    placeholder="Enter your college name"
                    required
                  />
                </label>
              )}
            </div>

            <div className="event-form-actions">
              <button type="button" className="logout-btn" onClick={() => {
                setShowRegistrationForm(false)
                setError('')
              }}>
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Register
              </button>
            </div>
          </form>
        </section>
      )
    }

    if (user?.role === 'staff' && showEventForm) {
      return (
        <section className="panel event-form-panel">
          <div className="panel-header">
            <h2>New Event</h2>
          </div>

          <form className="event-form" onSubmit={handleNewEventSubmit}>
            {error && <p className="error-message">{error}</p>}
            <div className="event-form-grid">
              <label className="event-form-field full">
                <span>Event Name</span>
                <input
                  type="text"
                  name="eventName"
                  value={newEvent.eventName}
                  onChange={handleEventFormChange}
                  placeholder="Enter event name"
                  required
                />
              </label>

              <label className="event-form-field">
                <span>Event Start Date</span>
                <input
                  type="date"
                  name="startDate"
                  value={newEvent.startDate}
                  onChange={handleEventFormChange}
                  required
                />
              </label>

              <label className="event-form-field">
                <span>Event End Date</span>
                <input
                  type="date"
                  name="endDate"
                  value={newEvent.endDate}
                  onChange={handleEventFormChange}
                  required
                />
              </label>

              <label className="event-form-field">
                <span>Start Time</span>
                <input
                  type="time"
                  name="startTime"
                  value={newEvent.startTime}
                  onChange={handleEventFormChange}
                  required
                />
              </label>

              <label className="event-form-field">
                <span>End Time</span>
                <input
                  type="time"
                  name="endTime"
                  value={newEvent.endTime}
                  onChange={handleEventFormChange}
                  required
                />
              </label>
              <label className="event-form-field full">
                <span>Registration closes</span>
                <input
                  type="date"
                  name="registrationDeadline"
                  value={newEvent.registrationDeadline}
                  onChange={handleEventFormChange}
                  required
                />
              </label>
            </div>

            <div className="event-form-actions">
              <button type="button" className="logout-btn" onClick={() => {
                setShowEventForm(false)
                setError('')
              }}>
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Save Event
              </button>
            </div>
          </form>
        </section>
      )
    }

    if (activeSection === 'Edit Profile') {
      return (
        <section className="panel profile-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Account settings</p>
              <h2>Edit profile</h2>
            </div>
            <button type="button" className="small-btn" onClick={() => openSection('Profile')}>Back to profile</button>
          </div>
          <form className="registration-form" onSubmit={handleProfileSave}>
            {error && <p className="error-message" role="alert">{error}</p>}
            <div className="registration-grid">
              <label className="registration-field">
                <span>Full name</span>
                <input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} required maxLength={100} />
              </label>
              <label className="registration-field">
                <span>Email</span>
                <input value={user?.email || ''} readOnly />
              </label>
              <label className="registration-field">
                <span>Department</span>
                <input value={profileForm.department} onChange={(event) => setProfileForm({ ...profileForm, department: event.target.value })} maxLength={100} />
              </label>
              <label className="registration-field">
                <span>College</span>
                <input value={profileForm.collegeName} onChange={(event) => setProfileForm({ ...profileForm, collegeName: event.target.value })} maxLength={120} />
              </label>
              <label className="registration-field">
                <span>Phone</span>
                <input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} maxLength={32} />
              </label>
            </div>
            <div className="event-form-actions">
              <button type="button" className="logout-btn" onClick={() => openSection('Profile')}>Cancel</button>
              <button type="submit" className="primary-btn">Save profile</button>
            </div>
          </form>
        </section>
      )
    }

    if (activeSection === 'Profile') {
      return (
        <section className="panel profile-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Your account</p>
              <h2>Profile</h2>
            </div>
            <button type="button" className="primary-btn" onClick={startProfileEdit}>Edit profile</button>
          </div>
          <div className="profile-detail">
            <div className="profile-avatar profile-avatar-large">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
            <div>
              <h3>{user?.name}</h3>
              <p>{user?.email}</p>
              <span className="user-role-badge">{user?.role}</span>
            </div>
          </div>
          <dl className="profile-details-grid">
            <div><dt>Department</dt><dd>{user?.department || 'Not added'}</dd></div>
            <div><dt>College</dt><dd>{user?.collegeName || 'Not added'}</dd></div>
            <div><dt>Phone</dt><dd>{user?.phone || 'Not added'}</dd></div>
            <div><dt>Portal role</dt><dd>{user?.role}</dd></div>
          </dl>
        </section>
      )
    }

    if (user?.role === 'staff') {
      switch (activeSection) {
        case 'Registrations': {
          const filteredRegistrations = registrations.filter((registration) => (
            registrationFilter === 'All' || registration.collegeType === registrationFilter
          ))
          return (
            <section className="panel updates-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Participants and teams</p>
                  <h2>Event Registrations</h2>
                </div>
                <label className="filter-field">
                  <span>College</span>
                  <select value={registrationFilter} onChange={(event) => setRegistrationFilter(event.target.value)}>
                    <option value="All">All colleges</option>
                    <option value="Inter-college">Inter-college</option>
                    <option value="Outer-college">Outer-college</option>
                  </select>
                </label>
              </div>
              {error && <p className="error-message" role="alert">{error}</p>}
              {renderRegistrationTable(filteredRegistrations, true)}
            </section>
          )
        }
        case 'Budget':
          return (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Live event metrics</p>
                  <h2>Budget and participation</h2>
                </div>
                <button type="button" className="small-btn" onClick={handleRefresh}>Refresh metrics</button>
              </div>
              <div className="mini-summary">
                <div><strong>{upcomingEvents.length}</strong><span>Events</span></div>
                <div><strong>{registrations.length}</strong><span>Teams</span></div>
                <div><strong>{registrations.reduce((total, item) => total + item.teamMembers, 0)}</strong><span>Participants</span></div>
              </div>
              <p className="helper-text">Financial budget tracking is not configured. Registration and participant totals update from saved event registrations.</p>
            </section>
          )
        case 'Calendar':
          return (
            <section className="content-grid two-column">
              <div className="panel">
                <div className="panel-header">
                  <h2>Calendar</h2>
                  <button type="button" className="small-btn" onClick={() => {
                    setError('')
                    setShowEventForm(true)
                  }}>Add Event</button>
                </div>
                <div className="calendar-list">
                  {upcomingEvents.map((entry) => (
                    <div key={entry.id} className="calendar-item">
                      <div className="calendar-date">
                        <span>{entry.startDate?.slice(-2) || entry.date}</span>
                      </div>
                      <div className="calendar-detail">
                        <strong>{entry.title}</strong>
                        <small>{entry.date} · {entry.time}</small>
                      </div>
                    </div>
                  ))}
                  {upcomingEvents.length === 0 && <p>No scheduled events.</p>}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Event Reminder</h2>
                  <button type="button" className="small-btn" onClick={() => setPinnedReminder((current) => !current)}>
                    {pinnedReminder ? 'Unpin' : 'Pin'}
                  </button>
                </div>
                <ul className="note-list">
                  <li>{pinnedReminder ? 'Pinned: ' : ''}Registration deadline is shown on each event card.</li>
                  <li>Upcoming events: {upcomingEvents.length}.</li>
                  <li>Registered student teams: {registrations.length}.</li>
                </ul>
              </div>
            </section>
          )
        case 'Student Updates':
          return (
            <section className="panel updates-panel">
              <div className="panel-header">
                <h2>Student Updates for Registration Process</h2>
                <button type="button" className="small-btn" onClick={addNotice}>Send Notice</button>
              </div>
              <div className="update-list">
                {notices.map((entry, index) => (
                  <article key={`${entry.title}-${index}`} className="update-card">
                    <span className="update-tag">{entry.tag}</span>
                    <h3>{entry.title}</h3>
                    <p>{entry.detail}</p>
                  </article>
                ))}
              </div>
            </section>
          )
        case 'Inter College Students':
          return (
            <section className="panel updates-panel">
              <div className="panel-header">
                <h2>Inter College Students</h2>
                <button type="button" className="small-btn" onClick={() => exportRows('inter-college-students.csv', registrations
                  .filter((entry) => entry.collegeType !== 'Outer-college')
                  .map(({ name, team, teamMemberNames, collegeName, event, status }) => ({ name, team, teamMemberNames, collegeName, event, status })))}>Export List</button>
              </div>
              <div className="student-table-wrap">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>Student / Team</th>
                      <th>Team members</th>
                      <th>College</th>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.filter((entry) => entry.collegeType !== 'Outer-college').map((student) => (
                      <tr key={student.id}>
                        <td><strong>{student.name}</strong><small className="table-secondary">{student.team}</small></td>
                        <td>{student.teamMemberNames || student.name}</td>
                        <td>{student.collegeName}</td>
                        <td>{student.event}</td>
                        <td><span className={`status ${student.status.toLowerCase()}`}>{student.status}</span></td>
                        <td className="review-actions">
                          <button type="button" className="small-btn" onClick={() => handleRegistrationStatus(student, 'Approved')}>Approve</button>
                          <button type="button" className="small-btn" onClick={() => handleRegistrationStatus(student, 'Waitlist')}>Waitlist</button>
                        </td>
                      </tr>
                    ))}
                    {registrations.filter((entry) => entry.collegeType !== 'Outer-college').length === 0 && (
                      <tr><td colSpan="6">No inter-college students yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        case 'Outer College Students':
          return (
            <section className="panel updates-panel">
              <div className="panel-header">
                <h2>Outer College Students</h2>
                <div className="topbar-actions">
                  <button type="button" className="small-btn" onClick={() => exportRows('outer-college-students.csv', registrations
                    .filter((entry) => entry.collegeType === 'Outer-college')
                    .map(({ name, team, teamMemberNames, collegeName, event, status }) => ({ name, team, teamMemberNames, collegeName, event, status })))}>Export List</button>
                  <button type="button" className="small-btn" onClick={() => {
                    setRegistrationFilter('Outer-college')
                    openSection('Registrations')
                  }}>Review</button>
                </div>
              </div>
              <div className="student-table-wrap">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>Student / Team</th>
                      <th>Team members</th>
                      <th>College name</th>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.filter((entry) => entry.collegeType === 'Outer-college').map((student) => (
                      <tr key={student.id}>
                        <td><strong>{student.name}</strong><small className="table-secondary">{student.team}</small></td>
                        <td>{student.teamMemberNames || student.name}</td>
                        <td>{student.collegeName}</td>
                        <td>{student.event}</td>
                        <td><span className={`status ${student.status.toLowerCase()}`}>{student.status}</span></td>
                        <td className="review-actions">
                          <button type="button" className="small-btn" onClick={() => handleRegistrationStatus(student, 'Approved')}>Approve</button>
                          <button type="button" className="small-btn" onClick={() => handleRegistrationStatus(student, 'Waitlist')}>Waitlist</button>
                        </td>
                      </tr>
                    ))}
                    {registrations.filter((entry) => entry.collegeType === 'Outer-college').length === 0 && (
                      <tr><td colSpan="6">No outer-college students yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        case 'Event Log':
          return (
            <section className="panel event-log-panel">
              <div className="panel-header">
                <h2>Event Log</h2>
                <button type="button" className="small-btn" onClick={() => exportRows('event-log.csv', eventLogs)}>Export Log</button>
              </div>
              <div className="event-log-list">
                {eventLogs.map((eventItem) => (
                  <div key={`${eventItem.time}-${eventItem.action}`} className="log-item">
                    <span className="log-time">{eventItem.time}</span>
                    <div>
                      <strong>{eventItem.action}</strong>
                      <small>By {eventItem.user}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        default:
          return (
            <>
              <section className="stats-grid">
                {liveStats.map((stat) => (
                  <article key={stat.label} className="stat-card">
                    <p>{stat.label}</p>
                    <h3>{stat.value}</h3>
                    <span>{stat.change}</span>
                  </article>
                ))}
              </section>

              <section className="profile-grid">
                <div className="panel profile-card-panel">
                  <div className="panel-header">
                    <h2>Profile</h2>
                    <button type="button" className="small-btn" onClick={startProfileEdit}>Edit</button>
                  </div>
                  <div className="dashboard-profile">
                    <div className="profile-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
                    <div>
                      <h3>{user?.name}</h3>
                      <p>{user?.email}</p>
                      <span>Staff Administrator</span>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <h2>Quick Actions</h2>
                  </div>
                  <div className="action-grid">
                    {quickActions.map((action) => (
                      <button key={action} className="action-btn" type="button" onClick={() => handleQuickAction(action)}>
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="main-grid">
                <div className="panel events-panel">
                  <div className="panel-header">
                    <h2>Upcoming Events</h2>
                    <button type="button" className="text-button" onClick={() => openSection('Calendar')}>View all</button>
                  </div>
                  <div className="event-list">
                    {upcomingEvents.map((event) => renderEventCard(event))}
                    {upcomingEvents.length === 0 && <p>No events have been published yet.</p>}
                  </div>
                </div>

                <div className="panel task-panel">
                  <div className="panel-header">
                    <h2>Action Items</h2>
                    <button type="button" className="text-button" onClick={handleRefresh}>Refresh</button>
                  </div>
                  <ul className="task-list">
                    {tasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          )
      }
    }

    switch (activeSection) {
      case 'Events':
        return (
          <section className="panel events-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Discover and join</p>
                <h2>All campus events</h2>
              </div>
              <button type="button" className="small-btn" onClick={handleRefresh}>Refresh events</button>
            </div>
            <div className="event-list event-list-grid">
              {upcomingEvents.map((event) => renderEventCard(event, true))}
              {upcomingEvents.length === 0 && <p>No events have been published yet.</p>}
            </div>
          </section>
        )
      case 'My Registrations':
      case 'Registration':
        return (
          <section className="panel updates-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Your event entries</p>
                <h2>My Registrations</h2>
              </div>
              <button type="button" className="small-btn" onClick={() => openSection('Events')}>Browse events</button>
            </div>
            {renderRegistrationTable(registrations, true)}
          </section>
        )
      case 'Calendar':
        return (
          <section className="content-grid two-column">
            <div className="panel">
              <div className="panel-header">
                <h2>Calendar</h2>
                <button type="button" className="small-btn" onClick={() => openSection('Events')}>Browse events</button>
              </div>
              <div className="calendar-list">
                {upcomingEvents.map((entry) => (
                  <div key={entry.id} className="calendar-item">
                    <div className="calendar-date">
                      <span>{entry.startDate?.slice(-2) || entry.date}</span>
                    </div>
                    <div className="calendar-detail">
                      <strong>{entry.title}</strong>
                      <small>{entry.date} · {entry.time}</small>
                    </div>
                  </div>
                ))}
                {upcomingEvents.length === 0 && <p>No scheduled events.</p>}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Student Notes</h2>
                <button type="button" className="small-btn" onClick={() => openSection('My Registrations')}>View registrations</button>
              </div>
              <ul className="note-list">
                <li>Submit registration form before deadline.</li>
                <li>Bring ID card for verification.</li>
                <li>Check event checklist on portal.</li>
              </ul>
            </div>
          </section>
        )
      case 'Event Log':
        return (
          <section className="panel event-log-panel">
            <div className="panel-header">
              <h2>Event Log</h2>
              <button type="button" className="small-btn" onClick={handleRefresh}>Sync</button>
            </div>
            <div className="event-log-list">
              {eventLogs.map((eventItem) => (
                <div key={`${eventItem.time}-${eventItem.action}`} className="log-item">
                  <span className="log-time">{eventItem.time}</span>
                  <div>
                    <strong>{eventItem.action}</strong>
                    <small>By {eventItem.user}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      default:
        return (
          <>
            <section className="stats-grid">
              {liveStats.map((stat) => (
                <article key={stat.label} className="stat-card">
                  <p>{stat.label}</p>
                  <h3>{stat.value}</h3>
                  <span>{stat.change}</span>
                </article>
              ))}
            </section>

            <section className="profile-grid">
              <div className="panel profile-card-panel">
                <div className="panel-header">
                  <h2>Profile</h2>
                  <button type="button" className="small-btn" onClick={startProfileEdit}>Edit</button>
                </div>
                <div className="dashboard-profile">
                  <div className="profile-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
                  <div>
                    <h3>{user?.name}</h3>
                    <p>{user?.email}</p>
                    <span>Student Member</span>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Registration Summary</h2>
                </div>
                <div className="mini-summary">
                  <div>
                    <strong>{registrations.length}</strong>
                    <span>Events joined</span>
                  </div>
                  <div>
                    <strong>{registrations.filter((registration) => registration.status === 'Pending').length}</strong>
                    <span>Pending</span>
                  </div>
                  <div>
                    <strong>{registrations.filter((registration) => registration.status === 'Waitlist').length}</strong>
                    <span>Waitlist</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="main-grid">
              <div className="panel events-panel">
                <div className="panel-header">
                  <h2>Upcoming Events</h2>
                  <button type="button" className="text-button" onClick={() => openSection('Events')}>View all</button>
                </div>
                <div className="event-list">
                  {upcomingEvents.map((event) => renderEventCard(event, true))}
                  {upcomingEvents.length === 0 && <p>No events have been published yet.</p>}
                </div>
              </div>

              <div className="panel task-panel">
                <div className="panel-header">
                  <h2>Registration Checklist</h2>
                  <button type="button" className="text-button" onClick={() => openSection('My Registrations')}>Open</button>
                </div>
                <ul className="task-list">
                  {['Complete profile', 'Upload ID card', 'Pay registration fee', 'Confirm event slot'].map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="brand-mark auth-brand">CE</div>
            <div>
              <p className="eyebrow">Campus Access</p>
              <h1>College Event Portal</h1>
            </div>
          </div>

          <div className="auth-switch">
            <button
              type="button"
              className={authMode === 'login' ? 'switch-btn active' : 'switch-btn'}
              onClick={() => setAuthMode('login')}
            >
              Log In
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'switch-btn active' : 'switch-btn'}
              onClick={() => setAuthMode('signup')}
            >
              Sign Up
            </button>
          </div>

          {authMode === 'login' && <div className="role-toggle">
            <button
              type="button"
              className={role === 'student' ? 'role-btn active' : 'role-btn'}
              onClick={() => setRole('student')}
            >
              Student
            </button>
            <button
              type="button"
              className={role === 'staff' ? 'role-btn active' : 'role-btn'}
              onClick={() => setRole('staff')}
            >
              Staff
            </button>
          </div>}

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === 'signup' && (
              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                />
              </label>
            )}

            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
              />
            </label>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="primary-btn auth-submit">
              {authMode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>

          <p className="demo-text">
            Demo accounts: student@college.edu / student123 and staff@college.edu / staff123. Passwords must be 8+ characters for new accounts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <div className="brand-mark">CE</div>
          <div>
            <p className="eyebrow">Campus Ops</p>
            <h2>EventFlow</h2>
          </div>
        </div>

        <nav className="nav">
          {dashboardLinks.map((item) => (
            <button
              key={item}
              type="button"
              className={activeSection === item ? 'nav-item active' : 'nav-item'}
              onClick={() => openSection(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <div className="avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div>
            <h3>{user?.name || 'User'}</h3>
            <p>{user?.role === 'staff' ? 'Staff Member' : 'Student'}</p>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>{activeSection === 'Dashboard' ? `${user?.role === 'staff' ? 'Staff' : 'Student'} Dashboard` : activeSection}</h1>
          </div>
          <div className="topbar-actions">
            <span className="user-role-badge">{user?.role}</span>
            {user?.role === 'staff' && (
              <button className="primary-btn" type="button" onClick={() => {
                setError('')
                setShowEventForm(true)
              }}>
                + New Event
              </button>
            )}
            <button className="logout-btn" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {error && !showEventForm && !showRegistrationForm && (
          <p className="error-message" role="alert">{error}</p>
        )}
        {renderDashboardBody()}
      </main>
    </div>
  )
}

export default App
