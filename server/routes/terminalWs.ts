import { WebSocketServer, WebSocket } from 'ws'
import { Server, IncomingMessage } from 'http'
import { execFileSync, execSync } from 'child_process'
import * as pty from 'node-pty'
import jwt from 'jsonwebtoken'
import { URL } from 'url'

const TERMINAL_IMAGES = ['cloudcodex-terminal', 'code-agent-terminal']

// ─── Check if Docker is available and image exists ──────────────────
function getDockerCommand(): string | null {
  const candidates = [
    process.env.DOCKER_BIN,
    'docker',
    '/usr/bin/docker',
    '/snap/bin/docker',
  ].filter((v): v is string => !!v)

  const uniqueCandidates = [...new Set(candidates)]

  for (const cmd of uniqueCandidates) {
    try {
      execFileSync(cmd, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      })
      return cmd
    } catch {
      // Keep probing known docker binary locations.
    }
  }

  return null
}

function getDockerStatus(dockerCmd: string): { available: boolean; error: string | null } {
  try {
    execFileSync(dockerCmd, ['info'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
    })
    return { available: true, error: null }
  } catch (err: any) {
    const stderr = (err?.stderr || '').toString().trim()
    const message = (err?.message || '').toString().trim()
    return { available: false, error: stderr || message || 'docker info failed' }
  }
}

function getAvailableTerminalImage(dockerCmd: string): string | null {
  for (const image of TERMINAL_IMAGES) {
    try {
      const result = execFileSync(dockerCmd, ['images', '-q', image], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      }).trim()
      if (result.length > 0) return image
    } catch {
      // Try next candidate image tag.
    }
  }

  return null
}

// ─── Sandboxed Docker terminal via node-pty ──────────────────────────
function spawnDockerTerminal(
  ws: WebSocket,
  cols: number,
  rows: number,
  image: string,
  dockerCmd: string
): pty.IPty {
  const containerName = `codex-term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const args = [
    'run', '--rm', '-it',
    '--name', containerName,
    // ── Network isolation ──
    '--network=none',
    // ── Resource limits ──
    '--memory=512m',
    '--cpus=1',
    '--pids-limit=128',
    image,
    'bash',
  ]

  const ptyProcess = pty.spawn(dockerCmd, args, {
    name: 'xterm-256color',
    cols,
    rows,
    env: { ...process.env, TERM: 'xterm-256color' },
  })

  // PTY output → WebSocket
  ptyProcess.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }))
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', exitCode }))
      ws.close()
    }
  })

  // WebSocket → PTY (input + resize)
  ws.on('message', (msg: Buffer | string) => {
    try {
      const parsed = JSON.parse(msg.toString())
      if (parsed.type === 'input') {
        ptyProcess.write(parsed.data)
      } else if (parsed.type === 'resize') {
        ptyProcess.resize(
          Math.max(parsed.cols || 80, 1),
          Math.max(parsed.rows || 24, 1)
        )
      }
    } catch {
      ptyProcess.write(msg.toString())
    }
  })

  ws.on('close', () => {
    ptyProcess.kill()
    // Force-remove the container just in case
    try {
      execFileSync(dockerCmd, ['rm', '-f', containerName], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      })
    } catch { /* container already removed by --rm */ }
  })

  ws.on('error', () => {
    ptyProcess.kill()
    try {
      execFileSync(dockerCmd, ['rm', '-f', containerName], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
      })
    } catch { /* ignore */ }
  })

  return ptyProcess
}

// ─── Main setup with JWT auth ───────────────────────────────────────
export function setupTerminalWebSocket(server: Server, jwtSecret: string) {
  const wss = new WebSocketServer({ noServer: true })

  // Intercept HTTP upgrade requests for JWT validation
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const pathname = new URL(req.url || '', `http://${req.headers.host}`).pathname

    if (pathname !== '/ws/terminal') return

    // Extract JWT from query param: ws://host/ws/terminal?token=xxx
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      console.log('  ❌ Terminal WS rejected: no token')
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    try {
      jwt.verify(token, jwtSecret)
    } catch {
      console.log('  ❌ Terminal WS rejected: invalid token')
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    // Token is valid — complete the WebSocket upgrade
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })

  wss.on('connection', (ws: WebSocket) => {
    const dockerCmd = getDockerCommand()
    const dockerStatus = dockerCmd ? getDockerStatus(dockerCmd) : { available: false, error: 'docker binary not found in PATH' }
    const terminalImage = dockerStatus.available && dockerCmd ? getAvailableTerminalImage(dockerCmd) : null
    const dockerReady = !!dockerCmd && dockerStatus.available && !!terminalImage

    if (!dockerReady) {
      // ── Refuse connection — no unsandboxed fallback ──
      const reason = !dockerCmd
        ? 'Docker CLI was not found (checked: DOCKER_BIN, docker, /usr/bin/docker, /snap/bin/docker).'
        : !dockerStatus.available
          ? `Docker is unreachable for this server process: ${dockerStatus.error}`
          : `No terminal image found. Expected one of: ${TERMINAL_IMAGES.join(', ')}`

      console.log('  ❌ Terminal refused:', reason)
      ws.send(JSON.stringify({
        type: 'output',
        data: [
          '\x1b[31m● Sandboxed terminal unavailable\x1b[0m\r\n',
          '\r\n',
          '\x1b[33mDocker is not running, not reachable, or the terminal image is missing.\x1b[0m\r\n',
          `\x1b[90mReason: ${reason}\x1b[0m\r\n`,
          '\x1b[33mTo fix this:\x1b[0m\r\n',
          '\x1b[90m  1. Ensure the server process user can run docker info\x1b[0m\r\n',
          '\x1b[90m  2. Build image: cd docker && docker build -t cloudcodex-terminal ./languages/terminal\x1b[0m\r\n',
          '\x1b[90m     (or tag as code-agent-terminal)\x1b[0m\r\n',
          '\r\n',
          '\x1b[31mLocal shell fallback is disabled for security.\x1b[0m\r\n',
        ].join(''),
      }))
      ws.close()
      return
    }

    console.log('  🐳 Terminal session via Docker container (sandboxed)')
    ws.send(JSON.stringify({
      type: 'output',
      data: '\x1b[32m● Sandboxed terminal (Docker container)\x1b[0m\r\n\r\n',
    }))

    try {
      spawnDockerTerminal(ws, 80, 24, terminalImage!, dockerCmd!)
    } catch (err: any) {
      console.error('  ❌ Failed to spawn sandboxed terminal:', err.message)
      ws.send(JSON.stringify({
        type: 'output',
        data: `\r\n\x1b[31mFailed to start sandboxed terminal: ${err.message}\x1b[0m\r\n`,
      }))
      ws.close()
    }
  })

  console.log('  🔒 Terminal WebSocket ready on /ws/terminal (sandboxed, JWT secured)')
}
