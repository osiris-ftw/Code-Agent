import express from 'express'
import cors from 'cors'
import executeRoutes, { isDockerRunning } from './routes/executeRoutes.js'
import { setupTerminalWebSocket } from './routes/terminalWs.js'
import jwt from 'jsonwebtoken'
import {
  createUser, verifyUser, getUserById,
  getUserFiles, saveFile, deleteFile,
  getChatMessages, saveChatMessage, clearChatMessages
} from './db.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

const PORT = 3001
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const JWT_SECRET = process.env.JWT_SECRET || 'cloudcodex-secret-key-change-in-production'

// ─── JWT Auth Middleware ──────────────────────────────────────────────
interface AuthRequest extends express.Request {
  userId?: number
}

function authMiddleware(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  try {
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    req.userId = decoded.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// ─── Auth Endpoints ──────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  try {
    const user = createUser(username, password)
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ user: { id: user.id, username: user.username }, token })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Username already exists' })
    }
    res.status(500).json({ error: 'Registration failed' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }
  const user = verifyUser(username, password)
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ user: { id: user.id, username: user.username }, token })
})

app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = getUserById(req.userId!)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  res.json({ user: { id: user.id, username: user.username } })
})

// ─── File CRUD Endpoints ─────────────────────────────────────────────
app.get('/api/files', authMiddleware, async (req: AuthRequest, res) => {
  const files = getUserFiles(req.userId!)
  res.json({ files })
})

app.post('/api/files', authMiddleware, async (req: AuthRequest, res) => {
  const { id, name, content, language } = req.body
  if (!id || !name) {
    return res.status(400).json({ error: 'File id and name are required' })
  }
  saveFile(req.userId!, { id, name, content: content || '', language: language || 'plaintext' })
  res.json({ success: true })
})

app.put('/api/files/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { name, content, language } = req.body
  const fileId = req.params.id as string
  saveFile(req.userId!, { id: fileId, name, content: content || '', language: language || 'plaintext' })
  res.json({ success: true })
})

app.delete('/api/files/:id', authMiddleware, async (req: AuthRequest, res) => {
  const fileId = req.params.id as string
  deleteFile(req.userId!, fileId)
  res.json({ success: true })
})

// ─── Chat CRUD Endpoints ─────────────────────────────────────────────
app.get('/api/chats', authMiddleware, async (req: AuthRequest, res) => {
  const messages = getChatMessages(req.userId!)
  res.json({ messages })
})

app.post('/api/chats', authMiddleware, async (req: AuthRequest, res) => {
  const { id, role, content } = req.body
  if (!id || !role || content === undefined) {
    return res.status(400).json({ error: 'id, role, and content are required' })
  }
  saveChatMessage(req.userId!, { id, role, content })
  res.json({ success: true })
})

app.delete('/api/chats', authMiddleware, async (req: AuthRequest, res) => {
  clearChatMessages(req.userId!)
  res.json({ success: true })
})

// ─── Mount execute routes ────────────────────────────────────────────
app.use('/api', executeRoutes)

// ─── POST /api/chat — Groq AI proxy (streaming) ─────────────────────
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set in .env file' })
  }

  const { messages, systemPrompt } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages array' })
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  // Build OpenAI-compatible messages array
  const groqMessages: any[] = []
  if (systemPrompt) {
    groqMessages.push({ role: 'system', content: systemPrompt })
  }
  for (const m of messages) {
    groqMessages.push({ role: m.role, content: m.content })
  }

  try {
    console.log(`  💬 Calling Groq (${model})...`)

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: groqMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Groq API error:', response.status, errBody)
      return res.status(response.status).json({ error: `Groq API error: ${response.status} — ${errBody}` })
    }

    // Stream SSE to client
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = response.body as any
    const decoder = new TextDecoder()
    let buffer = ''

    for await (const chunk of reader) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          res.write('data: [DONE]\n\n')
          continue
        }
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`)
          }
        } catch { }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: any) {
    console.error('Groq API error:', err.message || err)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'AI request failed' })
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
})


// ─── Health check ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', docker: isDockerRunning() })
})

// isDockerRunning is imported from executeRoutes

const server = app.listen(PORT, () => {
  console.log(`\n CodeAgent Server running on http://${SERVER_HOST}:${PORT}`)
  console.log(`   Auth:     POST /api/auth/register, /api/auth/login`)
  console.log(`   AI Chat:  POST /api/chat  (Groq)`)
  console.log(`   Execute: POST /api/run`)
  console.log(`   Files:   GET/POST/PUT/DELETE /api/files`)
  console.log(`   Chats:   GET/POST/DELETE /api/chats`)
  console.log(`   Terminal: WS  /ws/terminal`)
  console.log(`   Health:  GET  /api/health\n`)
})

setupTerminalWebSocket(server, JWT_SECRET)
