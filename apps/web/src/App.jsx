import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import StudentListPage from './pages/StudentListPage/StudentListPage';
import RecommendationPage from './pages/RecommendationPage/RecommendationPage';
// v2 pages
import Dashboard from './pages/Dashboard/Dashboard';
import StudentProfile from './pages/StudentProfile/StudentProfile';
import TargetSchools from './pages/TargetSchools/TargetSchools';
import AcademicPlan from './pages/AcademicPlan/AcademicPlan';
import SchoolDirectory from './pages/SchoolDirectory/SchoolDirectory';
import SchoolProfile from './pages/SchoolProfile/SchoolProfile';
import AccountSettings from './pages/AccountSettings/AccountSettings';
import AdminDataRefresh from './pages/AdminDataRefresh/AdminDataRefresh';
import CohortList from './pages/CohortList/CohortList';
import CohortDetail from './pages/CohortDetail/CohortDetail';
import CohortReport from './pages/CohortReport/CohortReport';
import DataAnalysis from './pages/DataAnalysis/DataAnalysis';
import SubjectDetail from './pages/SubjectDetail/SubjectDetail';
import EntityListPage from './pages/EntityListPage/EntityListPage';
import EntityDetailPage from './pages/EntityDetailPage/EntityDetailPage';
import ImportWizardPage from './pages/ImportWizardPage/ImportWizardPage';
import ConsultantTask from './pages/ConsultantTask/ConsultantTask';
import BulkEdit from './pages/BulkEdit/BulkEdit';
import Settings from './pages/Settings/Settings';
import MethodologyReport from './pages/MethodologyReport/MethodologyReport';
import Onboarding from './pages/Onboarding/Onboarding';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
        {/* Root redirect — keep /login as default for v1 compatibility */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* v1 public routes (unchanged) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* v1 protected routes (unchanged) */}
        <Route path="/students" element={<ProtectedRoute><StudentListPage /></ProtectedRoute>} />
        <Route path="/students/:id" element={<Navigate to="profile" replace />} />
        <Route path="/students/:id/recommendations" element={<ProtectedRoute><RecommendationPage /></ProtectedRoute>} />

        {/* v2 protected routes */}
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/students/:id/profile" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
        <Route path="/students/:id/targets" element={<ProtectedRoute><TargetSchools /></ProtectedRoute>} />
        <Route path="/students/:id/plan" element={<ProtectedRoute><AcademicPlan /></ProtectedRoute>} />
        <Route path="/students/:id/consultant" element={<ProtectedRoute><ConsultantTask /></ProtectedRoute>} />
        <Route path="/schools" element={<ProtectedRoute><SchoolDirectory /></ProtectedRoute>} />
        <Route path="/schools/:id" element={<ProtectedRoute><SchoolProfile /></ProtectedRoute>} />
        <Route path="/account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
        <Route path="/admin/data-refresh" element={<ProtectedRoute><AdminDataRefresh /></ProtectedRoute>} />
        <Route path="/cohorts" element={<ProtectedRoute><CohortList /></ProtectedRoute>} />
        <Route path="/cohorts/:id" element={<ProtectedRoute><CohortDetail /></ProtectedRoute>} />
        <Route path="/cohorts/:cohortId/report" element={<ProtectedRoute><CohortReport /></ProtectedRoute>} />
        <Route path="/cohorts/:cohortId/bulk-edit" element={<ProtectedRoute><BulkEdit /></ProtectedRoute>} />
        <Route path="/data-analysis" element={<ProtectedRoute><DataAnalysis /></ProtectedRoute>} />
        <Route path="/data-analysis/subjects/:subjectCode" element={<ProtectedRoute><SubjectDetail /></ProtectedRoute>} />

        <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="/methodology" element={<ProtectedRoute><MethodologyReport /></ProtectedRoute>} />

        {/* Entity routes (PLAT-03) */}
        <Route path="/entities/:name" element={<ProtectedRoute><EntityListPage /></ProtectedRoute>} />
        <Route path="/entities/:name/import" element={<ProtectedRoute><ImportWizardPage /></ProtectedRoute>} />
        <Route path="/entities/:name/:id" element={<ProtectedRoute><EntityDetailPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
