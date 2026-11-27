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
import MembersPage from './pages/MembersPage'; // Página de Membros
import SchedulesPage from './pages/SchedulesPage'; // Página de Escalas
import Onboarding from './pages/Onboarding';
import InvitePage from './pages/InvitePage';
import InvitesPage from './pages/InvitesPage';
import SubscriptionPage from './pages/SubscriptionPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Carregando...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Conta sem igreja: precisa aceitar um convite ou criar a igreja.
  if (profile && !profile.church_id && profile.role !== 'desenvolvedor') {
    return <Navigate to="/bem-vindo" replace />;
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

// /bem-vindo: só para quem está logado e ainda não tem igreja
const OnboardingRoute = () => {
  const { user, profile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.church_id || profile?.role === 'desenvolvedor') return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
};

function AppRoutes() {
  const { profile } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={<GuestRoute><LandingPage /></GuestRoute>} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/convite/:code" element={<InvitePage />} />
      <Route path="/bem-vindo" element={<OnboardingRoute />} />
      <Route path="/convites" element={<ProtectedRoute allowedRoles={['pastor', 'admin', 'supervisor', 'lider_homem', 'lider_mulher']}><InvitesPage /></ProtectedRoute>} />
      <Route path="/assinatura" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
      
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

      {/* Rota para Membros e Equipes */}
      <Route 
        path="/membros" 
        element={
          <ProtectedRoute>
            <MembersPage />
          </ProtectedRoute>
        } 
      />

      {/* Rota para Escalas */}
      <Route 
        path="/escalas" 
        element={
          <ProtectedRoute>
            <SchedulesPage />
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
