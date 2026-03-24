import { create } from 'zustand'

const API_URL = 'http://localhost:3001'

export interface File {
  id: string
  name: string
  content: string
  language: string
}

const EXT_LANG_MAP: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  sh: 'bash',
  bash: 'bash',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  txt: 'plaintext',
}

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_LANG_MAP[ext] || 'plaintext'
}

interface FileState {
  files: File[]
  activeFileId: string | null
  loaded: boolean
  addFile: (file: Omit<File, 'id'>) => void
  updateFileContent: (id: string, content: string) => void
  setActiveFile: (id: string) => void
  deleteFile: (id: string) => void
  loadFiles: (token: string) => Promise<void>
  syncFile: (file: File, token: string) => void
}

const DEFAULT_FILES: File[] = [
  {
    id: '1',
    name: 'main.py',
    content: 'def main():\n    print("Hello CodeAgent AI!")\n\nif __name__ == "__main__":\n    main()',
    language: 'python'
  },
  {
    id: '2',
    name: 'App.tsx',
    content: 'import React from "react";\n\nexport const App = () => {\n  return <div>Hello World</div>;\n};',
    language: 'typescript'
  }
]

function getToken(): string | null {
  return localStorage.getItem('cloudcodex_token')
}

export const useFileStore = create<FileState>((set, get) => ({
  files: DEFAULT_FILES,
  activeFileId: '1',
  loaded: false,

  loadFiles: async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/files`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.files && data.files.length > 0) {
        set({
          files: data.files,
          activeFileId: data.files[0]?.id || null,
          loaded: true,
        })
      } else {
        // First login: save default files to DB
        const token = getToken()
        if (token) {
          for (const f of DEFAULT_FILES) {
            fetch(`${API_URL}/api/files`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(f),
            }).catch(() => { })
          }
        }
        set({ loaded: true })
      }
    } catch {
      set({ loaded: true })
    }
  },

  syncFile: (file: File, token: string) => {
    fetch(`${API_URL}/api/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(file),
    }).catch(() => { })
  },

  addFile: (file) => {
    const id = Math.random().toString(36).substring(7)
    const newFile = { ...file, id }
    set((state) => ({
      files: [...state.files, newFile],
      activeFileId: id,
    }))
    const token = getToken()
    if (token) {
      get().syncFile(newFile, token)
    }
  },

  updateFileContent: (id, content) => {
    set((state) => ({
      files: state.files.map(f => f.id === id ? { ...f, content } : f)
    }))
    // Debounced sync - save after update
    const token = getToken()
    if (token) {
      const file = get().files.find(f => f.id === id)
      if (file) {
        get().syncFile({ ...file, content }, token)
      }
    }
  },

  setActiveFile: (id) => set({ activeFileId: id }),

  deleteFile: (id) => {
    set((state) => ({
      files: state.files.filter(f => f.id !== id),
      activeFileId: state.activeFileId === id ? (state.files[0]?.id || null) : state.activeFileId
    }))
    const token = getToken()
    if (token) {
      fetch(`${API_URL}/api/files/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => { })
    }
  }
}))
