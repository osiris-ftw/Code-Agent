import { Router } from 'express'
import { execFileSync, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()

// ─── Language → config mapping ───────────────────────────────────────
interface LangConfig {
  image: string
  filename: string
  runCmd: (file: string) => string
  localCmd?: (file: string) => string
}

const LANG_MAP: Record<string, LangConfig> = {
  python: {
    image: 'cloudcodex-python',
    filename: 'code.py',
    runCmd: (f) => `python3 ${f}`,
    localCmd: (f) => `python ${f}`,
  },
  javascript: {
    image: 'cloudcodex-javascript',
    filename: 'code.js',
    runCmd: (f) => `node ${f}`,
    localCmd: (f) => `node ${f}`,
  },
  typescript: {
    image: 'cloudcodex-javascript',
    filename: 'code.ts',
    runCmd: (f) => `tsx ${f}`,
    localCmd: (f) => `npx tsx ${f}`,
  },
  java: {
    image: 'cloudcodex-java',
    filename: 'Main.java',
    runCmd: () => `javac Main.java && java Main`,
    localCmd: (f) => `javac ${f} && java Main`,
  },
  c: {
    image: 'cloudcodex-c-cpp',
    filename: 'code.c',
    runCmd: (f) => `gcc ${f} -o code -lm && ./code`,
    localCmd: (f) => `gcc ${f} -o code.exe -lm && code.exe`,
  },
  cpp: {
    image: 'cloudcodex-c-cpp',
    filename: 'code.cpp',
    runCmd: (f) => `g++ ${f} -o code && ./code`,
    localCmd: (f) => `g++ ${f} -o code.exe && code.exe`,
  },
  go: {
    image: 'cloudcodex-go',
    filename: 'code.go',
    runCmd: (f) => `go run ${f}`,
    localCmd: (f) => `go run ${f}`,
  },
  rust: {
    image: 'cloudcodex-rust',
    filename: 'code.rs',
    runCmd: (f) => `rustc ${f} -o code && ./code`,
    localCmd: (f) => `rustc ${f} -o code.exe && code.exe`,
  },
  php: {
    image: 'cloudcodex-php',
    filename: 'code.php',
    runCmd: (f) => `php ${f}`,
    localCmd: (f) => `php ${f}`,
  },
  ruby: {
    image: 'cloudcodex-ruby',
    filename: 'code.rb',
    runCmd: (f) => `ruby ${f}`,
    localCmd: (f) => `ruby ${f}`,
  },
  bash: {
    image: 'cloudcodex-bash',
    filename: 'code.sh',
    runCmd: (f) => `bash ${f}`,
    localCmd: (f) => `bash ${f}`,
  },
  plaintext: {
    image: 'cloudcodex-bash',
    filename: 'code.sh',
    runCmd: (f) => `bash ${f}`,
    localCmd: (f) => `bash ${f}`,
  },
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

  try {
    let result: string

    if (dockerAvailable) {
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
        config.image,
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
