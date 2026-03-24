import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { FileCode, Eye, EyeOff, Loader2 } from 'lucide-react'

export function LoginPage() {
  const { login, register } = useAuthStore()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields')
      return
    }

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    const result = isRegister
      ? await register(username.trim(), password)
      : await login(username.trim(), password)

    if (!result.success) {
      setError(result.error || 'Something went wrong')
    }
    setIsLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-bg-grid" />

      {/* Floating particles */}
      <div className="login-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="login-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <FileCode className="w-8 h-8" />
          </div>
          <h1 className="login-title">CodeAgent</h1>
          <p className="login-subtitle">
            {isRegister ? 'Create your account' : 'Welcome back, developer'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="login-field">
            <label className="login-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="login-input"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="login-input"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                disabled={isLoading}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="login-field">
              <label className="login-label">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="login-input"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRegister ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              isRegister ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="login-toggle">
          <span className="login-toggle-text">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            type="button"
            className="login-toggle-btn"
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
              setConfirmPassword('')
            }}
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  )
}
