import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RoleRoute } from './auth/RoleRoute'
import { canAccessAccounts, canAccessAdmin, canAccessProjects } from './auth/roles'
import { LoginPage } from './pages/LoginPage'
import { AccountsPage } from './pages/AccountsPage'
import { AdminPage } from './pages/AdminPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route
          path="/projects"
          element={
            <RoleRoute allow={canAccessProjects}>
              <ProjectsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <RoleRoute allow={canAccessProjects}>
              <ProjectDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <RoleRoute allow={canAccessAccounts} redirectTo="/projects">
              <AccountsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleRoute allow={canAccessAdmin} redirectTo="/projects">
              <AdminPage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  )
}
