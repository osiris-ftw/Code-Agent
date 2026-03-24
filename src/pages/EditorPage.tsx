import { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Button } from '../components/ui/button'
import { 
  FileCode, 
  Play, 
  Settings, 
  User, 
  MessageSquare
} from 'lucide-react'
import { useFileStore } from '../store/fileStore'
import { useAIStore } from '../store/aiStore'
import { ChatPanel } from '../components/ChatPanel'
import { Sidebar } from '../components/Sidebar'

export function EditorPage() {
  const { files, activeFileId, updateFileContent } = useFileStore()
  const { isPanelOpen, setPanelOpen, setSelectedContext } = useAIStore()
  const activeFile = files.find(f => f.id === activeFileId)
  const editorRef = useRef<any>(null)
  
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    
    editor.addAction({
      id: 'ask-ai-selection',
      label: 'Ask CloudCodeX AI about selection',
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

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-primary">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <FileCode className="w-5 h-5" />
            </div>
            <span>CloudCodeX</span>
          </div>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <div className="text-sm font-medium text-muted-foreground">
            {activeFile?.name || 'No file selected'}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2 text-primary hover:text-primary hover:bg-primary/10">
            <Play className="w-4 h-4 fill-primary" />
            Run
          </Button>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <User className="w-4 h-4" />
          </Button>
          <Button 
            variant={isPanelOpen ? "secondary" : "ghost"} 
            size="icon" 
            className="w-8 h-8 ml-2"
            onClick={() => setPanelOpen(!isPanelOpen)}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content — resizable panels */}
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

          {/* Editor Area */}
          <Panel defaultSize={isPanelOpen ? "60%" : "85%"}>
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

          {isPanelOpen && (
            <>
              <Separator
                className="w-[3px] bg-border hover:bg-primary/50 cursor-col-resize transition-colors shrink-0"
                style={{ flexShrink: 0 }}
              />
              <Panel defaultSize="25%" minSize="20%" maxSize="40%">
                <div className="h-full overflow-hidden">
                  <ChatPanel />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
    </div>
  )
}
