const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
const defaultProtocol = window.location.protocol === 'https:' ? 'https' : 'http'
const defaultHost = window.location.hostname || '0.0.0.0'

export const API_URL = (rawApiUrl || `${defaultProtocol}://${defaultHost}:3001`).replace(/\/+$/, '')

const rawWsUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim()
const fallbackWsUrl = API_URL.startsWith('https://')
  ? API_URL.replace(/^https:\/\//, 'wss://')
  : API_URL.replace(/^http:\/\//, 'ws://')

export const WS_URL = (rawWsUrl || fallbackWsUrl).replace(/\/+$/, '')
