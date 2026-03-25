import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAuthStore } from '../store/authStore'
import { Button } from './ui/button'
import { Terminal as TerminalIcon, X, RotateCcw, ShieldCheck, ShieldAlert } from 'lucide-react'
import { WS_URL } from '../lib/config'

type SandboxStatus = 'connecting' | 'sandboxed' | 'unavailable' | 'error'

interface XTerminalPanelProps {
  onClose: () => void
  tabSwitcher?: React.ReactNode
}

export function XTerminalPanel({ onClose, tabSwitcher }: XTerminalPanelProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const { token } = useAuthStore()
  const [status, setStatus] = useState<SandboxStatus>('connecting')

  const cleanup = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    xtermRef.current?.dispose()
    xtermRef.current = null
    fitRef.current = null
  }, [])

  const connect = useCallback(() => {
    if (!termRef.current) return

    // Clean up any previous session
    cleanup()
    setStatus('connecting')

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#10b981',
        selectionBackground: '#3b82f640',
        black: '#1a1a2e',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e0e0e0',
        brightBlack: '#6b7280',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f9fafb',
      },
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(termRef.current)

    // Small delay to ensure DOM is ready before fitting
    setTimeout(() => fit.fit(), 50)

    xtermRef.current = term
    fitRef.current = fit

    // Connect WebSocket with JWT token
    const wsUrl = token
      ? `${WS_URL}/ws/terminal?token=${encodeURIComponent(token)}`
      : `${WS_URL}/ws/terminal`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      // Send initial size
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output') {
          term.write(msg.data)
          // Detect sandbox status from the server's initial banner
          if (msg.data.includes('Sandboxed terminal')) {
            setStatus('sandboxed')
          } else if (msg.data.includes('Sandboxed terminal unavailable') || msg.data.includes('unavailable')) {
            setStatus('unavailable')
          }
        } else if (msg.type === 'exit') {
          term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        }
      } catch {
        // Raw data fallback
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      term.write('\r\n\x1b[90m[Connection closed]\x1b[0m\r\n')
    }

    ws.onerror = () => {
      setStatus('error')
      term.write('\r\n\x1b[31m[Connection error — is the server running?]\x1b[0m\r\n')
    }

    // Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })
  }, [token, cleanup])

  useEffect(() => {
    connect()

    // Resize observer for auto-fit
    const observer = new ResizeObserver(() => {
      if (fitRef.current) {
        try { fitRef.current.fit() } catch { /* ignore */ }
      }
    })

    if (termRef.current) {
      observer.observe(termRef.current)
    }

    return () => {
      observer.disconnect()
      cleanup()
    }
  }, [connect, cleanup])

  const statusBadge = {
    connecting: { text: 'connecting...', color: 'text-yellow-400 bg-yellow-900/40' },
    sandboxed: { text: 'sandboxed', color: 'text-emerald-400 bg-emerald-900/40' },
    unavailable: { text: 'unavailable', color: 'text-red-400 bg-red-900/40' },
    error: { text: 'error', color: 'text-red-400 bg-red-900/40' },
  }[status]

  return (
    <div className="h-full flex flex-col bg-[#1a1a2e] border-t border-border">
      {/* Terminal Header */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between shrink-0 bg-[#16162a]">
        <div className="flex items-center gap-2">
          {tabSwitcher}
          {status === 'sandboxed' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : status === 'unavailable' || status === 'error' ? (
            <ShieldAlert className="w-4 h-4 text-red-400" />
          ) : (
            <TerminalIcon className="w-4 h-4 text-yellow-400" />
          )}
          <span className="text-sm font-medium text-gray-300">Terminal</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusBadge.color}`}>
            {statusBadge.text}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-gray-400 hover:text-gray-200 hover:bg-white/5"
            onClick={connect}
            title="Reconnect"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-gray-400 hover:text-gray-200 hover:bg-white/5"
            onClick={onClose}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* xterm.js container */}
      <div
        ref={termRef}
        className="flex-1 p-1"
        style={{ minHeight: 0 }}
      />
    </div>
  )
}
