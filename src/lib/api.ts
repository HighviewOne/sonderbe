const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const SUPABASE_STORAGE_KEY = `sb-${import.meta.env.VITE_SUPABASE_URL?.replace(/^https?:\/\//, '').split('.')[0]}-auth-token`

function getAuthHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
    if (stored) {
      const { access_token } = JSON.parse(stored)
      if (access_token) {
        return { Authorization: `Bearer ${access_token}` }
      }
    }
  } catch {
    // ignore parse errors
  }
  return {}
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const headers = getAuthHeaders()
  const response = await fetch(`${BASE_URL}${path}`, { headers })
  return handleResponse<T>(response)
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const headers = getAuthHeaders()
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return handleResponse<T>(response)
}

export async function apiPut<T = unknown>(path: string, body: unknown): Promise<T> {
  const headers = getAuthHeaders()
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return handleResponse<T>(response)
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const headers = getAuthHeaders()
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return handleResponse<T>(response)
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const headers = getAuthHeaders()
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers
  })
  return handleResponse<T>(response)
}

export async function apiUpload<T = unknown>(path: string, file: File, extraFields?: Record<string, string>): Promise<T> {
  const headers = getAuthHeaders()
  const formData = new FormData()
  formData.append('file', file)
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      formData.append(key, value)
    }
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData
  })
  return handleResponse<T>(response)
}
