import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import Login from './pages/Login.jsx';
import MyGrades from './pages/MyGrades.jsx';
import MyChoices from './pages/MyChoices.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/grades"
          element={
            <ProtectedRoute>
              <MyGrades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MyChoices />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
