import { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Button } from '../components/ui/button'
import {
  FileCode,
  Play,
  Settings,
  User,
  MessageSquare,
  Terminal,
  LogOut
} from 'lucide-react'
import { useFileStore } from '../store/fileStore'
import { useAIStore } from '../store/aiStore'
import { useAuthStore } from '../store/authStore'
import { ChatPanel } from '../components/ChatPanel'
import { Sidebar } from '../components/Sidebar'
import { XTerminalPanel } from '../components/XTerminalPanel'
import { TerminalPanel } from '../components/TerminalPanel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'
import { API_URL } from '../lib/config'

export function EditorPage() {
  const { files, activeFileId, updateFileContent, loadFiles, loaded } = useFileStore()
  const { isPanelOpen, setPanelOpen, setSelectedContext } = useAIStore()
  const { user, token, logout } = useAuthStore()
  const activeFile = files.find(f => f.id === activeFileId)
  const editorRef = useRef<any>(null)

  // Bottom panel state: 'output' for code run results, 'terminal' for interactive shell, null for closed
  const [bottomTab, setBottomTab] = useState<'output' | 'terminal' | null>(null)

  // Code execution state
  const [runOutput, setRunOutput] = useState('')
  const [runError, setRunError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [stdinValue, setStdinValue] = useState('')

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false)

  const backendLabel = API_URL.replace(/^https?:\/\//, '')

  // Load files from DB on mount
  useEffect(() => {
    if (token && !loaded) {
      loadFiles(token)
    }
  }, [token, loaded])

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor

    editor.addAction({
      id: 'ask-ai-selection',
      label: 'Ask CodeAgent AI about selection',
      contextMenuOrder: 0,
      contextMenuGroupId: 'navigation',
      run: (ed: any) => {
        const selection = ed.getSelection()
        const selectedText = ed.getModel().getValueInRange(selection)
        if (selectedText) {
          setSelectedContext(selectedText)
          setPanelOpen(true)
        }
      }
    })
  }

  const handleEditorChange = (value: string | undefined) => {
    if (activeFileId && value !== undefined) {
      updateFileContent(activeFileId, value)
    }
  }

  const handleRun = async () => {
    if (!activeFile) return
    setBottomTab('output')
    setIsRunning(true)
    setRunOutput('')
    setRunError(null)
    setExitCode(null)

    try {
      const res = await fetch(`${API_URL}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeFile.content,
          language: activeFile.language,
          stdin: stdinValue || undefined,
        }),
      })
      const data = await res.json()
      setRunOutput(data.output || '')
      setRunError(data.error || null)
      setExitCode(data.exitCode ?? null)
    } catch (err: any) {
      setRunError(err.message || 'Execution failed')
      setExitCode(1)
    } finally {
      setIsRunning(false)
    }
  }

  const isBottomPanelOpen = bottomTab !== null



  const handleLogout = () => {
    logout()
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-primary">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <FileCode className="w-5 h-5" />
            </div>
            <span>CodeAgent</span>
          </div>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <div className="text-sm font-medium text-muted-foreground">
            {activeFile?.name || 'No file selected'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-primary hover:text-primary hover:bg-primary/10"
            onClick={handleRun}
            disabled={!activeFile}
          >
            <Play className="w-4 h-4 fill-primary" />
            Run
          </Button>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <User className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.username || 'Guest User'}</p>
                <p className="text-xs text-muted-foreground">CodeAgent IDE</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Terminal toggle */}
          <Button
            variant={bottomTab === 'terminal' ? "secondary" : "ghost"}
            size="icon"
            className="w-8 h-8"
            onClick={() => setBottomTab(bottomTab === 'terminal' ? null : 'terminal')}
          >
            <Terminal className="w-4 h-4" />
          </Button>

          <Button
            variant={isPanelOpen ? "secondary" : "ghost"}
            size="icon"
            className="w-8 h-8"
            onClick={() => setPanelOpen(!isPanelOpen)}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Group
          orientation="horizontal"
          className="flex h-full w-full"
          style={{ height: '100%' }}
        >
          {/* File Explorer */}
          <Panel defaultSize="15%" minSize="10%" maxSize="25%">
            <div className="h-full overflow-hidden">
              <Sidebar />
            </div>
          </Panel>

          <Separator
            className="w-[3px] bg-border hover:bg-primary/50 cursor-col-resize transition-colors shrink-0"
            style={{ flexShrink: 0 }}
          />

          {/* Editor + Terminal Area */}
          <Panel defaultSize={isPanelOpen ? "55%" : "85%"}>
            <Group
              orientation="vertical"
              className="flex flex-col h-full w-full"
              style={{ height: '100%' }}
            >
              {/* Editor */}
              <Panel defaultSize={isBottomPanelOpen ? "65%" : "100%"} minSize="30%">
                <div className="h-full bg-[#1e1e1e] overflow-hidden">
                  {activeFile ? (
                    <Editor
                      height="100%"
                      language={activeFile.language}
                      theme="vs-dark"
                      value={activeFile.content}
                      onChange={handleEditorChange}
                      onMount={handleEditorDidMount}
                      options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 }
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Select a file to start coding
                    </div>
                  )}
                </div>
              </Panel>

              {isBottomPanelOpen && (
                <>
                  <Separator
                    className="h-[3px] bg-border hover:bg-primary/50 cursor-row-resize transition-colors shrink-0"
                    style={{ flexShrink: 0 }}
                  />
                  <Panel defaultSize="35%" minSize="15%" maxSize="60%">
                    {(() => {
                      const tabSwitcher = (
                        <div className="flex items-center gap-0 mr-3">
                          <button
                            onClick={() => setBottomTab('output')}
                            className={`px-2.5 py-0.5 text-[10px] font-medium rounded-l transition-colors ${
                              bottomTab === 'output'
                                ? 'text-emerald-300 bg-emerald-900/40'
                                : 'text-gray-500 bg-gray-800/50 hover:text-gray-300'
                            }`}
                          >
                            Output
                          </button>
                          <button
                            onClick={() => setBottomTab('terminal')}
                            className={`px-2.5 py-0.5 text-[10px] font-medium rounded-r transition-colors ${
                              bottomTab === 'terminal'
                                ? 'text-emerald-300 bg-emerald-900/40'
                                : 'text-gray-500 bg-gray-800/50 hover:text-gray-300'
                            }`}
                          >
                            Terminal
                          </button>
                        </div>
                      )
                      return bottomTab === 'output' ? (
                        <TerminalPanel
                          output={runOutput}
                          error={runError}
                          isRunning={isRunning}
                          exitCode={exitCode}
                          stdinValue={stdinValue}
                          onStdinChange={setStdinValue}
                          onClear={() => { setRunOutput(''); setRunError(null); setExitCode(null) }}
                          onClose={() => setBottomTab(null)}
                          tabSwitcher={tabSwitcher}
                        />
                      ) : (
                        <XTerminalPanel
                          onClose={() => setBottomTab(null)}
                          tabSwitcher={tabSwitcher}
                        />
                      )
                    })()}
                  </Panel>
                </>
              )}
            </Group>
          </Panel>

          {isPanelOpen && (
            <>
              <Separator
                className="w-[3px] bg-border hover:bg-primary/50 cursor-col-resize transition-colors shrink-0"
                style={{ flexShrink: 0 }}
              />
              <Panel defaultSize="30%" minSize="20%" maxSize="40%">
                <div className="h-full overflow-hidden">
                  <ChatPanel />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Editor</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Font Size: 14px</p>
                <p>• Theme: VS Dark</p>
                <p>• Word Wrap: On</p>
                <p>• Minimap: Enabled</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Execution</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Runtime: Docker Containers (local fallback)</p>
                <p>• Timeout: 30 seconds</p>
                <p>• Memory Limit: 256 MB</p>
                <p>• Network: Disabled (sandboxed)</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">AI Assistant</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Model: Llama 3.3 70B (Groq)</p>
                <p>• Backend: {backendLabel}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
