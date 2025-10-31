import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'

// Layouts
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Reviews from './pages/Reviews'
import Periods from './pages/Periods'
import PeriodDetail from './pages/PeriodDetail'
import Templates from './pages/Templates'
import WorkflowBuilder from './pages/WorkflowBuilder'
import TrialBalance from './pages/TrialBalance'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import FileCabinet from './pages/FileCabinet'

function App() {
  const { token } = useAuthStore()

  if (!token) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/periods" element={<Periods />} />
        <Route path="/periods/:periodId" element={<PeriodDetail />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/workflow" element={<WorkflowBuilder />} />
        <Route path="/trial-balance" element={<TrialBalance />} />
        <Route path="/file-cabinet" element={<FileCabinet />} />
        <Route path="/users" element={<Users />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default App

