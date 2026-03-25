import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  CalendarClock, 
  UsersRound, 
  Video, 
  Bell, 
  UserPlus, 
  UserCircle, 
  LogOut 
} from 'lucide-react';

export default function Sidebar({ children }) {
  const { profile, logout } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Eventos', path: '/eventos', icon: CalendarDays },
    { name: 'Membros', path: '/membros', icon: Users },
    { name: 'Escalas', path: '/escalas', icon: CalendarClock },
    { name: 'Pequenos Grupos', path: '#!pgs', icon: UsersRound },
    { name: 'Vídeos', path: '#!videos', icon: Video },
    { name: 'Notificações', path: '#!notificacoes', icon: Bell, badge: 5 },
    { name: 'Convites', path: '#!convites', icon: UserPlus },
    { name: 'Minha Conta', path: '/perfil', icon: UserCircle },
  ];

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-300 font-sans overflow-hidden">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-[#1e293b] flex flex-col justify-between border-r border-slate-800 shrink-0">
        <div className="p-6 flex flex-col">
          {/* Logo / Título */}
          <div className="flex items-center gap-3 mb-10 text-white">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
              <span className="font-bold text-xl">IG</span>
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Igreja Digital</h2>
              <p className="text-xs text-slate-400">Sistema de Gestão</p>
            </div>
          </div>

          {/* Navegação */}
          <nav className="flex flex-col gap-2">
            {menuItems.map((item, index) => (
              <NavLink
                key={index}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive && !item.path.startsWith('#')
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                      : 'hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Botão de Sair no Rodapé da Sidebar */}
        <div className="p-6 border-t border-slate-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-left font-medium text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className="flex-1 overflow-y-auto bg-[#0f172a] p-8">
        {children}
      </main>
    </div>
  );
}
