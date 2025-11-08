import { Route, Routes, Navigate } from 'react-router-dom'
import Chat from './pages/Chat'
import Home from './pages/Home'
import { useAuth } from './context/AuthContext'
import Auth from './pages/Auth'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/home" element={<Protected><Home /></Protected>} />
      <Route path="/" element={<Protected><Chat /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
