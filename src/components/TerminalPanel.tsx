import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Terminal, Trash2, X, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'

interface TerminalPanelProps {
  output: string
  error: string | null
  isRunning: boolean
  exitCode: number | null
  stdinValue: string
  onStdinChange: (value: string) => void
  onClear: () => void
  onClose: () => void
  tabSwitcher?: React.ReactNode
}

export function TerminalPanel({ output, error, isRunning, exitCode, stdinValue, onStdinChange, onClear, onClose, tabSwitcher }: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [output, error])

  return (
    <div className="h-full flex flex-col bg-[#1a1a2e] border-t border-border">
      {/* Terminal Header */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between shrink-0 bg-[#16162a]">
        <div className="flex items-center gap-2">
          {tabSwitcher}
          <Terminal className="w-4 h-4 text-emerald-400" />
          {isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running...
            </div>
          )}
          {!isRunning && exitCode !== null && (
            <div className={`flex items-center gap-1 text-xs ${exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {exitCode === 0 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Exit code: {exitCode}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-6 h-6 text-gray-400 hover:text-gray-200 hover:bg-white/5" onClick={onClear}>
            <Trash2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-gray-400 hover:text-gray-200 hover:bg-white/5" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* stdin input */}
      <div className="px-4 py-2 border-b border-border/30 bg-[#141428] flex items-center gap-2">
        <span className="text-xs text-gray-500 font-mono shrink-0">stdin:</span>
        <input
          type="text"
          value={stdinValue}
          onChange={e => onStdinChange(e.target.value)}
          placeholder="Enter input for your program (stdin)..."
          className="flex-1 bg-transparent border border-border/30 rounded px-3 py-1.5 text-sm text-gray-200 font-mono placeholder:text-gray-600 focus:outline-none focus:border-emerald-400/50 transition-colors"
        />
      </div>

      {/* Terminal Output */}
      <ScrollArea className="flex-1 p-4 font-mono text-sm" ref={scrollRef}>
        {!output && !error && !isRunning && (
          <div className="text-gray-500 text-xs">
            Press <span className="text-emerald-400 font-semibold">▶ Run</span> to execute your code...
          </div>
        )}
        {output && (
          <pre className="text-gray-200 whitespace-pre-wrap break-words leading-relaxed">{output}</pre>
        )}
        {error && (
          <pre className="text-red-400 whitespace-pre-wrap break-words leading-relaxed mt-1">{error}</pre>
        )}
        {isRunning && !output && !error && (
          <div className="flex items-center gap-2 text-amber-400 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            Executing code...
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
