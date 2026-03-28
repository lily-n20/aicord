import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await login(email, password)
    if (useAuthStore.getState().user) {
      navigate('/app')
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md bg-bg-secondary rounded-lg p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-text-muted mt-2">Sign in to continue to AICORD</p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-md p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError() }}
              required
              className="w-full bg-bg-primary border border-bg-modifier rounded-md px-3 py-2.5 text-text-normal placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
              placeholder="you@example.com"
            />
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
              className="w-full bg-bg-primary border border-bg-modifier rounded-md px-3 py-2.5 text-text-normal placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition-colors"
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-text-muted text-sm text-center mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
