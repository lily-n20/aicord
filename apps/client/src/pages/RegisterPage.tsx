import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface FieldErrors {
  username?: string
  email?: string
  password?: string
}

function validate(username: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (username.length < 3 || username.length > 32) {
    errors.username = 'Must be 3–32 characters'
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.username = 'Only letters, numbers, and underscores'
  }
  if (!email.includes('@')) {
    errors.email = 'Enter a valid email'
  }
  if (password.length < 8) {
    errors.password = 'Must be at least 8 characters'
  }
  return errors
}

export function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const { register, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validate(username, email, password)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    await register(username, email, password)
    if (useAuthStore.getState().user) {
      navigate('/app')
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md bg-bg-secondary rounded-lg p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Create an account</h1>
          <p className="text-text-muted mt-2">Join AICORD today</p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-md p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); clearError() }}
              required
              className={`w-full bg-bg-primary border rounded-md px-3 py-2.5 text-text-normal placeholder-text-muted focus:outline-none transition-colors ${
                fieldErrors.username ? 'border-danger focus:border-danger' : 'border-bg-modifier focus:border-brand'
              }`}
              placeholder="cooluser_42"
            />
            {fieldErrors.username && (
              <p className="text-danger text-xs mt-1">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError() }}
              required
              className={`w-full bg-bg-primary border rounded-md px-3 py-2.5 text-text-normal placeholder-text-muted focus:outline-none transition-colors ${
                fieldErrors.email ? 'border-danger focus:border-danger' : 'border-bg-modifier focus:border-brand'
              }`}
              placeholder="you@example.com"
            />
            {fieldErrors.email && (
              <p className="text-danger text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError() }}
              required
              className={`w-full bg-bg-primary border rounded-md px-3 py-2.5 text-text-normal placeholder-text-muted focus:outline-none transition-colors ${
                fieldErrors.password ? 'border-danger focus:border-danger' : 'border-bg-modifier focus:border-brand'
              }`}
              placeholder="••••••••"
            />
            {fieldErrors.password && (
              <p className="text-danger text-xs mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition-colors"
          >
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-text-muted text-sm text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
