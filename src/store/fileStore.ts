import { create } from 'zustand'

export interface File {
  id: string
  name: string
  content: string
  language: string
}

interface FileState {
  files: File[]
  activeFileId: string | null
  addFile: (file: Omit<File, 'id'>) => void
  updateFileContent: (id: string, content: string) => void
  setActiveFile: (id: string) => void
  deleteFile: (id: string) => void
}

const DEFAULT_FILES: File[] = [
  {
    id: '1',
    name: 'main.py',
    content: 'def main():\n    print("Hello CloudCodeX AI!")\n\nif __name__ == "__main__":\n    main()',
    language: 'python'
  },
  {
    id: '2',
    name: 'App.tsx',
    content: 'import React from "react";\n\nexport const App = () => {\n  return <div>Hello World</div>;\n};',
    language: 'typescript'
  }
]

export const useFileStore = create<FileState>((set) => ({
  files: DEFAULT_FILES,
  activeFileId: '1',
  addFile: (file) => set((state) => ({
    files: [...state.files, { ...file, id: Math.random().toString(36).substring(7) }]
  })),
  updateFileContent: (id, content) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, content } : f)
  })),
  setActiveFile: (id) => set({ activeFileId: id }),
  deleteFile: (id) => set((state) => ({
    files: state.files.filter(f => f.id !== id),
    activeFileId: state.activeFileId === id ? (state.files[0]?.id || null) : state.activeFileId
  }))
}))
