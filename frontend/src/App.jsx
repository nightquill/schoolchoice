import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import StudentListPage from './pages/StudentListPage/StudentListPage';
import StudentDetailPage from './pages/StudentDetailPage/StudentDetailPage';
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
import DataAnalysis from './pages/DataAnalysis/DataAnalysis';
import SubjectDetail from './pages/SubjectDetail/SubjectDetail';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirect — keep /login as default for v1 compatibility */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* v1 public routes (unchanged) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* v1 protected routes (unchanged) */}
        <Route path="/students" element={<ProtectedRoute><StudentListPage /></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute><StudentDetailPage /></ProtectedRoute>} />
        <Route path="/students/:id/recommendations" element={<ProtectedRoute><RecommendationPage /></ProtectedRoute>} />

        {/* v2 protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/students/:id/profile" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
        <Route path="/students/:id/targets" element={<ProtectedRoute><TargetSchools /></ProtectedRoute>} />
        <Route path="/students/:id/plan" element={<ProtectedRoute><AcademicPlan /></ProtectedRoute>} />
        <Route path="/schools" element={<ProtectedRoute><SchoolDirectory /></ProtectedRoute>} />
        <Route path="/schools/:id" element={<ProtectedRoute><SchoolProfile /></ProtectedRoute>} />
        <Route path="/account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
        <Route path="/admin/data-refresh" element={<ProtectedRoute><AdminDataRefresh /></ProtectedRoute>} />
        <Route path="/cohorts" element={<ProtectedRoute><CohortList /></ProtectedRoute>} />
        <Route path="/cohorts/:id" element={<ProtectedRoute><CohortDetail /></ProtectedRoute>} />
        <Route path="/data-analysis" element={<ProtectedRoute><DataAnalysis /></ProtectedRoute>} />
        <Route path="/data-analysis/subjects/:subjectCode" element={<ProtectedRoute><SubjectDetail /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
