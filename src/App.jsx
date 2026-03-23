import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Páginas Provisórias (Serão criadas em breve)
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import DevDashboard from './pages/DevDashboard';
import Profile from './pages/Profile';
import UserDashboard from './pages/UserDashboard'; // Dashboard para Pastor, Líder, etc.
import EventsPage from './pages/EventsPage'; // Página de Eventos

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Carregando...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Se usuário estiver logado e tentar ir para o login, redireciona
const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  const { profile } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={<GuestRoute><LandingPage /></GuestRoute>} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      
      {/* Rota para o Dashboard Dinâmico */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            {profile?.role === 'desenvolvedor' ? <DevDashboard /> : <UserDashboard />}
          </ProtectedRoute>
        } 
      />

      {/* Rota para Eventos */}
      <Route 
        path="/eventos" 
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/perfil" 
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-900 text-white font-sans">
          <Toaster position="top-right" />
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
