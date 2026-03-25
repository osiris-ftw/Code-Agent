import { Router } from 'express'
import { execFileSync, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()

// ─── Language → config mapping ───────────────────────────────────────
interface LangConfig {
  images: string[]
  filename: string
  runCmd: (file: string) => string
  localCmd?: (file: string) => string
}

const LANG_MAP: Record<string, LangConfig> = {
  python: {
    images: ['cloudcodex-python', 'code-agent-python'],
    filename: 'code.py',
    runCmd: (f) => `python3 ${f}`,
    localCmd: (f) => (process.platform === 'win32' ? `python ${f}` : `python3 ${f}`),
  },
  javascript: {
    images: ['cloudcodex-javascript', 'code-agent-javascript'],
    filename: 'code.js',
    runCmd: (f) => `node ${f}`,
    localCmd: (f) => `node ${f}`,
  },
  typescript: {
    images: ['cloudcodex-javascript', 'code-agent-javascript'],
    filename: 'code.ts',
    runCmd: (f) => `tsx ${f}`,
    localCmd: (f) => `npx tsx ${f}`,
  },
  java: {
    images: ['cloudcodex-java', 'code-agent-java'],
    filename: 'Main.java',
    runCmd: () => `javac Main.java && java Main`,
    localCmd: (f) => `javac ${f} && java Main`,
  },
  c: {
    images: ['cloudcodex-c-cpp', 'code-agent-c-cpp'],
    filename: 'code.c',
    runCmd: (f) => `gcc ${f} -o code -lm && ./code`,
    localCmd: (f) => (process.platform === 'win32' ? `gcc ${f} -o code.exe -lm && code.exe` : `gcc ${f} -o code -lm && ./code`),
  },
  cpp: {
    images: ['cloudcodex-c-cpp', 'code-agent-c-cpp'],
    filename: 'code.cpp',
    runCmd: (f) => `g++ ${f} -o code && ./code`,
    localCmd: (f) => (process.platform === 'win32' ? `g++ ${f} -o code.exe && code.exe` : `g++ ${f} -o code && ./code`),
  },
  go: {
    images: ['cloudcodex-go', 'code-agent-go'],
    filename: 'code.go',
    runCmd: (f) => `go run ${f}`,
    localCmd: (f) => `go run ${f}`,
  },
  rust: {
    images: ['cloudcodex-rust', 'code-agent-rust'],
    filename: 'code.rs',
    runCmd: (f) => `rustc ${f} -o code && ./code`,
    localCmd: (f) => (process.platform === 'win32' ? `rustc ${f} -o code.exe && code.exe` : `rustc ${f} -o code && ./code`),
  },
  php: {
    images: ['cloudcodex-php', 'code-agent-php'],
    filename: 'code.php',
    runCmd: (f) => `php ${f}`,
    localCmd: (f) => `php ${f}`,
  },
  ruby: {
    images: ['cloudcodex-ruby', 'code-agent-ruby'],
    filename: 'code.rb',
    runCmd: (f) => `ruby ${f}`,
    localCmd: (f) => `ruby ${f}`,
  },
  bash: {
    images: ['cloudcodex-bash', 'code-agent-bash'],
    filename: 'code.sh',
    runCmd: (f) => `bash ${f}`,
    localCmd: (f) => `bash ${f}`,
  },
  plaintext: {
    images: ['cloudcodex-bash', 'code-agent-bash'],
    filename: 'code.sh',
    runCmd: (f) => `bash ${f}`,
    localCmd: (f) => `bash ${f}`,
  },
}

function resolveAvailableImage(images: string[]): string | null {
  for (const image of images) {
    try {
      const result = execSync(`docker images -q ${image}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      if (result.length > 0) return image
    } catch {
      // Continue checking candidate tags.
    }
  }

  return null
}

// ─── Docker availability check ──────────────────────────────────────
export function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

// ─── POST /api/run — Execute code ────────────────────────────────────
router.post('/run', async (req, res) => {
  const { code, language, stdin } = req.body

  if (!code || !language) {
    return res.status(400).json({ error: 'Missing code or language' })
  }

  const config = LANG_MAP[language]
  if (!config) {
    return res.status(400).json({ error: `Unsupported language: ${language}` })
  }

  // Write code to a temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudcodex-'))
  const filePath = path.join(tmpDir, config.filename)
  fs.writeFileSync(filePath, code, 'utf-8')

  // Write stdin to file if provided
  if (stdin) {
    fs.writeFileSync(path.join(tmpDir, 'stdin.txt'), stdin, 'utf-8')
  }

  const dockerAvailable = isDockerRunning()
  const dockerImage = dockerAvailable ? resolveAvailableImage(config.images) : null

  try {
    let result: string

    if (dockerAvailable && dockerImage) {
      // ── Docker execution using execFileSync (array args, no shell quoting issues) ──
      const runCommand = config.runCmd(config.filename)
      const stdinRedirect = stdin ? ` < /code/stdin.txt` : ''
      const shellCmd = `${runCommand}${stdinRedirect}`

      const args = [
        'run', '--rm',
        '--network=none',
        '--memory=256m',
        '--cpus=1',
        '--pids-limit=64',
        '-v', `${tmpDir}:/code`,
        '-w', '/code',
        dockerImage,
        'sh', '-c', shellCmd,
      ]

      result = execFileSync('docker', args, {
        timeout: 30000,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
      })
    } else {
      // ── Local fallback execution ──
      if (!config.localCmd) {
        return res.status(400).json({
          error: `No local execution support for ${language}. Please install Docker.`,
        })
      }

      const localCommand = config.localCmd(config.filename)
      const stdinRedirect = stdin ? ` < stdin.txt` : ''
      const fullCmd = `${localCommand}${stdinRedirect}`

      result = execSync(fullCmd, {
        timeout: 30000,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
        cwd: tmpDir,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      })
    }

    res.json({ output: result, error: null, exitCode: 0 })
  } catch (err: any) {
    const stdout = err.stdout || ''
    const stderr = err.stderr || ''
    res.json({
      output: stdout,
      error: stderr || err.message,
      exitCode: err.status || 1,
    })
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { }
  }
})

export default router
