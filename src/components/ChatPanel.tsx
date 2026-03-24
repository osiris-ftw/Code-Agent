import { useState, useRef, useEffect } from 'react'
import { useFileStore, detectLanguage } from '../store/fileStore'
import { useAIStore } from '../store/aiStore'
import { useAuthStore } from '../store/authStore'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Send, User, Bot, Trash2, X, Loader2, Code2, Copy, Check, FilePlus, FileCheck } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../lib/utils'
import { AGENT_SYSTEM_PROMPT } from '../lib/agent'

const API_URL = 'http://localhost:3001'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ─── Parse "language:filename" from code fence className ─────────────
function parseFileTarget(className?: string): { lang: string; filename: string } | null {
  if (!className) return null
  // className is like "language-c:hello.c" from markdown
  const match = className.match(/^language-(\w+):(.+)$/)
  if (match) {
    return { lang: match[1], filename: match[2] }
  }
  return null
}

// ─── Copy Button Code Block ─────────────────────────────────────────
function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState(false)
  const codeText = extractText(children)
  const fileTarget = parseFileTarget(className)
  const lang = fileTarget?.lang || className?.replace('language-', '') || ''

  const { files, addFile, updateFileContent, setActiveFile } = useFileStore()

  const existingFile = fileTarget
    ? files.find(f => f.name === fileTarget.filename)
    : null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = codeText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleApply = () => {
    if (!fileTarget) return

    if (existingFile) {
      // Update existing file
      updateFileContent(existingFile.id, codeText)
      setActiveFile(existingFile.id)
    } else {
      // Create new file
      addFile({
        name: fileTarget.filename,
        content: codeText,
        language: detectLanguage(fileTarget.filename),
      })
    }
    setApplied(true)
    setTimeout(() => setApplied(false), 3000)
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">
          {fileTarget ? fileTarget.filename : (lang || 'code')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {fileTarget && (
            <button
              className={cn(
                "code-block-copy",
                applied && "code-block-applied"
              )}
              onClick={handleApply}
              disabled={applied}
              title={applied ? 'Applied!' : existingFile ? `Apply to ${fileTarget.filename}` : `Create ${fileTarget.filename}`}
              style={{
                background: applied
                  ? 'rgba(34,197,94,0.2)'
                  : 'rgba(59,130,246,0.15)',
                borderColor: applied
                  ? 'rgba(34,197,94,0.4)'
                  : 'rgba(59,130,246,0.3)',
                color: applied ? '#22c55e' : '#60a5fa',
                border: '1px solid',
                borderRadius: '6px',
                padding: '2px 8px',
                cursor: applied ? 'default' : 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
            >
              {applied ? (
                <><Check className="w-3 h-3" /> Applied!</>
              ) : existingFile ? (
                <><FileCheck className="w-3 h-3" /> Apply</>
              ) : (
                <><FilePlus className="w-3 h-3" /> Create</>
              )}
            </button>
          )}
          <button
            className={cn("code-block-copy", copied && "code-block-copied")}
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre className="code-block-pre">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as any).props.children)
  }
  return ''
}

export function ChatPanel() {
  const { files, activeFileId } = useFileStore()
  const { setPanelOpen, selectedContext, setSelectedContext } = useAIStore()
  const { token } = useAuthStore()
  const activeFile = files.find(f => f.id === activeFileId)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load chat history from DB
  useEffect(() => {
    if (token && !loaded) {
      fetch(`${API_URL}/api/chats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })))
          }
          setLoaded(true)
        })
        .catch(() => setLoaded(true))
    }
  }, [token])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Save message to DB
  const saveMessageToDB = (msg: ChatMessage) => {
    if (!token) return
    fetch(`${API_URL}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(msg),
    }).catch(() => { })
  }

  const clearMessages = () => {
    setMessages([])
    if (token) {
      fetch(`${API_URL}/api/chats`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => { })
    }
  }

  const addMessage = (role: 'user' | 'assistant', content: string): string => {
    const id = Math.random().toString(36).substring(7)
    const msg = { id, role, content }
    setMessages(prev => [...prev, msg])
    if (role === 'user') saveMessageToDB(msg)
    return id
  }

  const updateLastAssistantMessage = (content: string) => {
    setMessages(prev => {
      const updated = [...prev]
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant') {
          updated[i] = { ...updated[i], content }
          break
        }
      }
      return updated
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    addMessage('user', text)
    setInput('')
    setIsLoading(true)

    // Build messages array for AI
    const chatHistory = [...messages, { id: '', role: 'user' as const, content: text }]
      .map(m => ({ role: m.role, content: m.content }))

    // Add empty assistant message for streaming
    const assistantId = addMessage('assistant', '')

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          systemPrompt: AGENT_SYSTEM_PROMPT,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        updateLastAssistantMessage(`⚠️ Error: ${err.error || 'Failed to get AI response'}`)
        setIsLoading(false)
        return
      }

      // Stream the response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulated += parsed.text
                  updateLastAssistantMessage(accumulated)
                }
                if (parsed.error) {
                  accumulated += `\n\n⚠️ Error: ${parsed.error}`
                  updateLastAssistantMessage(accumulated)
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      }

      // Save completed assistant message to DB
      saveMessageToDB({ id: assistantId, role: 'assistant', content: accumulated })
    } catch (err: any) {
      updateLastAssistantMessage(`⚠️ Could not connect to AI server. Make sure the backend is running on port 3001.\n\nError: ${err.message}`)
    }

    setIsLoading(false)
  }

  const onSendSuggestion = (text: string) => {
    if (isLoading) return

    let fullPrompt = text
    if (activeFile) {
      fullPrompt += `\n\n[CONTEXT: Current File: ${activeFile.name}, Language: ${activeFile.language}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``
    }

    sendMessage(fullPrompt)
  }

  const onSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    let fullPrompt = input

    if (messages.length === 0 || input.toLowerCase().includes('this file') || input.toLowerCase().includes('the code')) {
      if (activeFile) {
        fullPrompt += `\n\n[CONTEXT: Current File: ${activeFile.name}, Language: ${activeFile.language}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``
      }
    }

    if (selectedContext) {
      fullPrompt += `\n\n[CONTEXT: Selected Code Snippet]\n\`\`\`${activeFile?.language || ''}\n${selectedContext}\n\`\`\``
      setSelectedContext(null)
    }

    sendMessage(fullPrompt)
  }

  return (
    <div className="h-full bg-card border-l flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="w-5 h-5 text-primary" />
          <span>CodeAgent AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={clearMessages}>
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setPanelOpen(false)}>
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-6 max-w-full overflow-hidden">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 pt-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Welcome to CodeAgent AI</h3>
                <p className="text-sm text-muted-foreground max-w-[240px]">
                  I can help you write, explain, debug, and review your code. I can also create and edit files directly!
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                <SuggestionButton text="Explain this file" onClick={() => onSendSuggestion("Explain this file for me")} />
                <SuggestionButton text="Find bugs in my code" onClick={() => onSendSuggestion("Can you find any bugs or potential issues in this code?")} />
                <SuggestionButton text="Suggest improvements" onClick={() => onSendSuggestion("Suggest some improvements for better performance or readability")} />
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}>
                {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "flex flex-col space-y-2 max-w-[85%]",
                message.role === 'user' ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed overflow-hidden",
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted/50 border rounded-tl-none prose prose-sm dark:prose-invert max-w-none"
                )}>
                  {message.role === 'user' ? (
                    message.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre: ({ children }) => <>{children}</>,
                        code: ({ className, children }) => {
                          const isBlock = className?.startsWith('language-') ||
                            (typeof children === 'string' && children.includes('\n'))

                          if (isBlock) {
                            return <CodeBlock className={className}>{children}</CodeBlock>
                          }

                          return (
                            <code className={cn("bg-background/30 px-1.5 py-0.5 rounded text-primary", className)}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
              <div className="px-4 py-3 bg-muted/50 border rounded-2xl rounded-tl-none flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background shrink-0">
        {selectedContext && (
          <div className="mb-2 p-2 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2 truncate">
              <Code2 className="w-3 h-3 text-primary shrink-0" />
              <span className="text-[10px] font-medium text-primary truncate">Context: Selected Code</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-4 h-4 text-primary hover:bg-primary/20"
              onClick={() => setSelectedContext(null)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
        <form onSubmit={onSend} className="relative">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me anything..."
            className="pr-12 py-6 bg-muted/30 border-muted focus-visible:ring-primary/50"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-1.5 top-1.5 w-9 h-9"
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2 px-4">
          CodeAgent AI can make mistakes. Please verify important code.
        </p>
      </div>
    </div>
  )
}

function SuggestionButton({ text, onClick }: { text: string, onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs justify-start hover:bg-primary/5 hover:text-primary hover:border-primary/30 h-8"
      onClick={onClick}
    >
      {text}
    </Button>
  )
}