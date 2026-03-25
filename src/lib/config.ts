const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
const defaultProtocol = window.location.protocol === 'https:' ? 'https' : 'http'
const defaultHost = window.location.hostname || '0.0.0.0'

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')

  // Accept proxy-style values like /api or api without creating /api/api/* requests.
  if (trimmed === '/api' || trimmed === 'api' || trimmed === '/api/') {
    return ''
  }

  // If user provides a full URL ending with /api, strip only that final segment.
  return trimmed.replace(/\/api$/i, '')
}

export const API_URL = normalizeApiUrl(rawApiUrl || `${defaultProtocol}://${defaultHost}:3001`)

const rawWsUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim()
const fallbackWsUrl = API_URL
  ? (API_URL.startsWith('https://')
    ? API_URL.replace(/^https:\/\//, 'wss://')
    : API_URL.replace(/^http:\/\//, 'ws://'))
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

export const WS_URL = (rawWsUrl || fallbackWsUrl).replace(/\/+$/, '')
