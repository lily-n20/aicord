import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { useAuthStore } from './store/authStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppPlaceholder() {
  const { user, logout } = useAuthStore()
  return (
    <div className="min-h-full bg-bg-primary flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-brand rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-white">
            {user?.username[0].toUpperCase()}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome, {user?.username}!</h1>
        <p className="text-text-muted mb-6">AICORD is being built. Sprint 2 coming next.</p>
        <button
          onClick={logout}
          className="bg-bg-secondary hover:bg-bg-modifier text-text-normal px-4 py-2 rounded-md transition-colors text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <AppPlaceholder />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
