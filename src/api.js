const TOKEN_KEY = 'eventPortalToken'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new ApiError('Cannot reach the event portal API. Restart the app with npm run dev.')
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new ApiError(
      `The API returned an unexpected response (HTTP ${response.status}). Restart the app with npm run dev.`,
      response.status,
    )
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(`The API response was invalid (HTTP ${response.status}). Restart the app with npm run dev.`, response.status)
  }
  if (!response.ok) throw new ApiError(payload.error || 'The request could not be completed.', response.status)
  return payload
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function hasToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}
