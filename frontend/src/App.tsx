import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HistoryListPage } from './pages/HistoryListPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MedicationCreatePage } from './pages/MedicationCreatePage';
import { MedicationDetailPage } from './pages/MedicationDetailPage';
import { MedicationListPage } from './pages/MedicationListPage';
import { MedicationScanPage } from './pages/MedicationScanPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';
import { AnalysisDetailPage } from './pages/AnalysisDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/**
 * Root application component.
 *
 * Phase 2 routes are added below. Other module agents (medications,
 * interactions, history, dashboard, settings) MUST insert their routes at
 * the marked insertion point so this file remains merge-friendly.
 *
 * Reserved (added by other agents at MODULE_ROUTES_INSERTION_POINT):
 *   - /dashboard      (protected)
 *   - /medications    (protected, list/new/scan/:id)
 *   - /interactions   (protected, /new and /:id)
 *   - /history        (protected)
 *   - /settings       (protected)
 */
export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />

            {/* Auth Module */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Medications */}
            <Route
              path="/medications"
              element={
                <ProtectedRoute>
                  <MedicationListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/medications/new"
              element={
                <ProtectedRoute>
                  <MedicationCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/medications/scan"
              element={
                <ProtectedRoute>
                  <MedicationScanPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/medications/:id"
              element={
                <ProtectedRoute>
                  <MedicationDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Interactions */}
            <Route
              path="/interactions/new"
              element={
                <ProtectedRoute>
                  <NewAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interactions/:id"
              element={
                <ProtectedRoute>
                  <AnalysisDetailPage />
                </ProtectedRoute>
              }
            />

            {/* History */}
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <HistoryListPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
