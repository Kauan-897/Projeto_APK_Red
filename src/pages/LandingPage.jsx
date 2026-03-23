import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Calendar, ClipboardList, Users, Shield, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-500/30">
      {/* Navbar */}
      <nav className="fixed w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">Gestão Igreja</span>
            </div>
            
            <Link 
              to="/login"
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]"
            >
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-8">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Sistema Completo de Gestão</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            Organize sua igreja <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 border-b border-transparent">
              de forma simples
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Gerencie eventos, escalas, membros e ministérios em um único lugar. 
            Tudo que você precisa para uma gestão eficiente.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]"
            >
              Começar Agora
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button 
              className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all duration-200 border border-slate-700 hover:border-slate-600"
            >
              Ver Demonstração
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Calendar />}
              title="Agenda"
              description="Calendário completo com eventos recorrentes e notificações automáticas"
            />
            <FeatureCard 
              icon={<ClipboardList />}
              title="Escalas"
              description="Sistema completo de escalas com troca de turnos e aprovação de líderes"
            />
            <FeatureCard 
              icon={<Users />}
              title="Gestão de Membros"
              description="Organize membros por ministérios e acompanhe participação"
            />
            <FeatureCard 
              icon={<Shield />}
              title="Controle de Acesso"
              description="Diferentes níveis de permissão para admins, líderes e membros"
            />
          </div>

          {/* Simple Visual Preview Area */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-80 place-items-center">
             <div className="w-full aspect-[4/3] bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 w-full h-12 bg-slate-800 border-b border-white/5 flex items-center px-4 gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                   <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                   <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                </div>
                <div className="mt-16 mx-4 grid gap-2">
                   <div className="h-4 bg-slate-700 rounded w-1/4"></div>
                   <div className="h-12 bg-slate-700/50 rounded flex items-center px-3 gap-2 mt-4">
                      <div className="w-8 h-8 rounded bg-red-500/20"></div>
                      <div className="h-2 bg-slate-600 rounded w-1/2"></div>
                   </div>
                   <div className="h-12 bg-slate-700/50 rounded flex items-center px-3 gap-2">
                      <div className="w-8 h-8 rounded bg-blue-500/20"></div>
                      <div className="h-2 bg-slate-600 rounded w-1/3"></div>
                   </div>
                </div>
             </div>

             <div className="w-full aspect-[4/3] bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative hidden md:block group hover:scale-[1.02] transition-transform">
                <div className="absolute top-0 w-full h-12 bg-slate-800 border-b border-white/5 flex items-center px-4 gap-2 text-xs text-slate-400">
                    <Calendar className="w-4 h-4 text-red-400" /> Agenda Geral
                </div>
                <div className="mt-16 p-4">
                   <div className="w-full border border-slate-700 rounded-lg overflow-hidden">
                       <div className="flex border-b border-slate-700 bg-slate-800">
                           {['D','S','T','Q','Q','S','S'].map((d, i) => (
                               <div key={i} className={`flex-1 p-2 text-center text-xs ${i === 0 ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
                           ))}
                       </div>
                       <div className="grid grid-cols-7 gap-[1px] bg-slate-700">
                            {Array.from({length: 14}).map((_, i) => (
                                <div key={i} className="aspect-square bg-slate-900 p-1">
                                    <div className="text-[10px] text-slate-500">{i+1}</div>
                                    {i === 5 && <div className="mt-1 w-full h-1 bg-red-500 rounded"></div>}
                                    {i === 12 && <div className="mt-1 w-full h-1 bg-blue-500 rounded"></div>}
                                </div>
                            ))}
                       </div>
                   </div>
                </div>
             </div>

             <div className="w-full aspect-[4/3] bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative hidden lg:block">
                 <div className="absolute top-0 w-full h-12 bg-slate-800 border-b border-white/5 flex items-center px-4 justify-between">
                     <div className="h-4 bg-slate-700 rounded w-1/3"></div>
                     <div className="w-6 h-6 rounded-full bg-slate-700"></div>
                 </div>
                 <div className="mt-16 mx-4 grid grid-cols-2 gap-4">
                     <div className="h-20 bg-slate-700/30 rounded-lg border border-white/5 p-3 flex flex-col justify-between">
                        <Users className="w-5 h-5 text-slate-400" />
                        <div className="text-xl font-bold text-white">124</div>
                     </div>
                     <div className="h-20 bg-slate-700/30 rounded-lg border border-white/5 p-3 flex flex-col justify-between">
                        <ClipboardList className="w-5 h-5 text-slate-400" />
                        <div className="text-xl font-bold text-white">8</div>
                     </div>
                     <div className="col-span-2 h-20 bg-red-500/10 rounded-lg border border-red-500/20 p-3 flex flex-col justify-between">
                        <Calendar className="w-5 h-5 text-red-500" />
                        <div className="text-xl font-bold text-red-500">Culto Domingo</div>
                     </div>
                 </div>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 bg-black text-center">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Gestão Igreja. Sistema desenvolvido para facilitar a gestão de igrejas.
        </p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => {
  return (
    <div className="p-8 rounded-2xl bg-black border border-white/5 hover:border-red-500/30 transition-all duration-300 group hover:-translate-y-1">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6 group-hover:scale-110 group-hover:bg-red-500/20 transition-all">
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-gray-400 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
};

export default LandingPage;
