import { Plus, FileCode, Folder, ChevronRight, MoreVertical, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { useFileStore } from '../store/fileStore'
import { cn } from '../lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export function Sidebar() {
  const { files, activeFileId, setActiveFile, addFile, deleteFile } = useFileStore()

  const handleCreateFile = () => {
    const name = prompt('File name:')
    if (name) {
      const ext = name.split('.').pop()
      let language = 'plaintext'
      if (ext === 'py') language = 'python'
      else if (ext === 'ts' || ext === 'tsx') language = 'typescript'
      else if (ext === 'js' || ext === 'jsx') language = 'javascript'
      else if (ext === 'c') language = 'c'
      else if (ext === 'cpp') language = 'cpp'
      else if (ext === 'java') language = 'java'
      else if (ext === 'go') language = 'go'
      else if (ext === 'rs') language = 'rust'
      else if (ext === 'php') language = 'php'
      else if (ext === 'rb') language = 'ruby'
      
      addFile({
        name,
        content: '',
        language
      })
    }
  }

  return (
    <div className="h-full bg-card border-r flex flex-col">
      <div className="p-4 flex items-center justify-between border-b shrink-0">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Folder className="w-4 h-4 text-primary" />
          <span>PROJECT</span>
        </div>
        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={handleCreateFile}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {files.map(file => (
            <div
              key={file.id}
              className={cn(
                "group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                activeFileId === file.id 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveFile(file.id)}
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode className={cn(
                  "w-4 h-4 shrink-0",
                  activeFileId === file.id ? "text-primary" : "text-muted-foreground"
                )} />
                <span className="text-sm truncate font-medium">{file.name}</span>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-6 h-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteFile(file.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
