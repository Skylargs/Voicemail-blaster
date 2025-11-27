import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import AppLayout from './layouts/AppLayout'
import MarketingLanding from './pages/MarketingLanding'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CampaignsPage from './pages/CampaignsPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import CallLogsPage from './pages/CallLogsPage'
import SettingsPage from './pages/SettingsPage'
import OnboardingPage from './pages/OnboardingPage'

function App() {
  // Initialize dark mode on app load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
  }, [])

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <MarketingLanding />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="call-logs" element={<CallLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
