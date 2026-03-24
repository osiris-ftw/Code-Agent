import { useRef, useEffect } from 'react'
import { useAgent } from '@blinkdotnew/react'
import { cloudCodeXAgent } from '../lib/agent'
import { useFileStore } from '../store/fileStore'
import { useAIStore } from '../store/aiStore'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Send, User, Bot, Trash2, X, Loader2, Code2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../lib/utils'

export function ChatPanel() {
  const { files, activeFileId } = useFileStore()
  const { setPanelOpen, selectedContext, setSelectedContext } = useAIStore()
  const activeFile = files.find(f => f.id === activeFileId)
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    clearMessages,
    sendMessage
  } = useAgent({
    agent: cloudCodeXAgent,
    onFinish: (response) => {
      console.log('Agent finished:', response)
    }
  })

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
    
    // Include file context if it's the first message or a specific question
    if (messages.length === 0 || input.toLowerCase().includes('this file') || input.toLowerCase().includes('the code')) {
      if (activeFile) {
        fullPrompt += `\n\n[CONTEXT: Current File: ${activeFile.name}, Language: ${activeFile.language}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``
      }
    }

    // Include selected context if present
    if (selectedContext) {
      fullPrompt += `\n\n[CONTEXT: Selected Code Snippet]\n\`\`\`${activeFile?.language || ''}\n${selectedContext}\n\`\`\``
      setSelectedContext(null) // Clear context after use
    }
    
    sendMessage(fullPrompt)
  }

  return (
    <div className="h-full bg-card border-l flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Bot className="w-5 h-5 text-primary" />
          <span>CloudCodeX AI</span>
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
                <h3 className="font-bold text-lg">Welcome to CloudCodeX AI</h3>
                <p className="text-sm text-muted-foreground max-w-[240px]">
                  I can help you write, explain, debug, and review your code.
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
                        pre: ({ children }) => <pre className="bg-background/50 rounded-lg p-4 my-4 overflow-x-auto border">{children}</pre>,
                        code: ({ className, children }) => (
                          <code className={cn("bg-background/30 px-1.5 py-0.5 rounded text-primary", className)}>
                            {children}
                          </code>
                        )
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
          CloudCodeX AI can make mistakes. Please verify important code.
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