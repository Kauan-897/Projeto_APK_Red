import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { Users, CalendarDays, Video, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';

export default function UserDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    members: 0,
    eventsCount: 0,
    videosCount: 0,
    presenceRate: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [latestVideo, setLatestVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    if (profile?.church_id) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const churchId = profile.church_id;

      // Buscar Estatísticas Básicas
      const { count: membersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('church_id', churchId);
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count: eventsCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).eq('church_id', churchId).gte('date', startOfMonth);
      const { count: videosCount } = await supabase.from('videos').select('*', { count: 'exact', head: true }).eq('church_id', churchId);
      
      let presence = 0;
      const { data: attendanceData } = await supabase.from('attendance').select('status').eq('profile_id', profile.id);
      if (attendanceData && attendanceData.length > 0) {
        const presents = attendanceData.filter(a => a.status === 'presente').length;
        presence = Math.round((presents / attendanceData.length) * 100);
      } else {
        presence = 100;
      }

      setStats({
        members: membersCount || 0,
        eventsCount: eventsCount || 0,
        videosCount: videosCount || 0,
        presenceRate: presence,
      });

      // Buscar Próximos Eventos
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('church_id', churchId)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(3);
      
      setUpcomingEvents(eventsData || []);

      // Buscar Vídeo em Destaque
      const { data: videoData } = await supabase
        .from('videos')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (videoData && videoData.length > 0) {
        setLatestVideo(videoData[0]);
      }

      // Buscar Atividades Recentes (Máximo 7 dias, limite de 3 de cada tipo)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoISO = oneWeekAgo.toISOString();

      const { data: rProfiles } = await supabase.from('profiles').select('*').eq('church_id', churchId).gte('created_at', oneWeekAgoISO).order('created_at', { ascending: false }).limit(3);
      const { data: rEvents } = await supabase.from('events').select('*').eq('church_id', churchId).gte('created_at', oneWeekAgoISO).order('created_at', { ascending: false }).limit(3);
      const { data: rVideos } = await supabase.from('videos').select('*').eq('church_id', churchId).gte('created_at', oneWeekAgoISO).order('created_at', { ascending: false }).limit(3);

      let acts = [];
      if (rProfiles) acts.push(...rProfiles.map(p => ({ title: 'Novo membro cadastrado', desc: p.full_name || p.email, date: new Date(p.created_at) })));
      if (rEvents) acts.push(...rEvents.map(e => ({ title: 'Novo evento agendado', desc: e.title, date: new Date(e.created_at) })));
      if (rVideos) acts.push(...rVideos.map(v => ({ title: 'Novo vídeo publicado', desc: v.title, date: new Date(v.created_at) })));
      
      acts.sort((a, b) => b.date - a.date);
      setRecentActivities(acts.slice(0, 5));

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    }
    setLoading(false);
  };

  const handleOpenVideo = () => {
    if (latestVideo?.url) {
      setShowVideoModal(true);
    }
  };

  const confirmOpenVideo = () => {
    setShowVideoModal(false);
    window.open(latestVideo.url, '_blank');
  };

  const formatTimeAgo = (date) => {
    if (!date || isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;
    const diffMins = Math.floor(diff / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return `há ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return `há 1 dia`;
    if (diffDays < 7) return `há ${diffDays} dias`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="flex h-full items-center justify-center text-slate-400">
          Carregando informações da sua Sede...
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Bem-vindo ao sistema de gestão da sua sede</p>
        </div>
      </div>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{stats.members}</h3>
          <p className="text-slate-400 text-sm font-medium">Total de Membros</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CalendarDays className="w-5 h-5" />
            </div>
            {stats.eventsCount > 0 && <span className="bg-emerald-500/10 text-emerald-500 text-xs font-bold px-2 py-1 rounded">+{stats.eventsCount}</span>}
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{stats.eventsCount}</h3>
          <p className="text-slate-400 text-sm font-medium">Eventos este Mês</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Video className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{stats.videosCount}</h3>
          <p className="text-slate-400 text-sm font-medium">Vídeos Publicados</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="bg-amber-500/10 text-amber-500 text-xs font-bold px-2 py-1 rounded">Pessoal</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{stats.presenceRate}%</h3>
          <p className="text-slate-400 text-sm font-medium">Taxa de Presença</p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendario e Recentes (Esquerda 2 Cols) */}
        <div className="col-span-1 lg:col-span-2 space-y-8">
          
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg h-64 flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="text-xl font-bold text-white absolute top-6 left-6">Calendário</h3>
            <div className="text-slate-500 flex flex-col items-center">
              <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">Integração do calendário em breve.</p>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Atividades Recentes</h3>
            <div className="space-y-6">
              {recentActivities.length > 0 ? (
                recentActivities.map((act, i) => (
                  <div key={i} className="flex gap-4 items-start relative before:content-[''] before:absolute before:left-2 before:top-6 before:w-px before:h-full before:bg-slate-700 last:before:hidden">
                    <div className="w-4 h-4 rounded-full bg-slate-700 border-2 border-slate-800 shadow-sm shrink-0 mt-1 relative z-10"></div>
                    <div>
                      <h4 className="font-semibold text-slate-200 text-sm">{act.title}</h4>
                      <p className="text-xs text-slate-500">{act.desc} - {formatTimeAgo(act.date)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Nenhuma atividade recente registrada para esta Sede.</p>
              )}
            </div>
          </div>
        </div>

        {/* Proximos Eventos e Videos (Direita 1 Col) */}
        <div className="space-y-8">
          
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-white">Próximos Eventos</h3>
               {upcomingEvents.length > 0 && <button className="text-sm text-red-500 hover:text-red-400 font-medium transition">Ver todos</button>}
             </div>
             <div className="space-y-4">
                {upcomingEvents.length > 0 ? (
                   upcomingEvents.map((evt) => (
                      <div key={evt.id} className="flex gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
                        <div className="bg-emerald-600/20 text-emerald-500 w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0">
                           <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                           <h4 className="font-bold text-white text-sm line-clamp-1">{evt.title}</h4>
                           <p className="text-xs text-slate-400 mb-1">{evt.date.split('-').reverse().join('/')} às {evt.time?.substring(0, 5)}</p>
                        </div>
                        {evt.attendees_count > 0 && (
                          <div className="text-right flex flex-col justify-center">
                             <span className="text-[10px] text-slate-500">Confirmados</span>
                             <span className="font-bold text-emerald-400 text-sm leading-none mt-1">{evt.attendees_count}</span>
                          </div>
                        )}
                      </div>
                   ))
                ) : (
                  <div className="text-center py-4">
                     <p className="text-sm text-slate-500">Nenhum evento futuro agendado.</p>
                  </div>
                )}
             </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
             <div className="flex items-center gap-2 mb-4">
               <h3 className="text-xl font-bold text-white text-wrap break-words">{latestVideo?.title || 'Nenhum vídeo salvo'}</h3>
               {latestVideo && <span className="inline-block bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Destaque</span>}
             </div>
             
             {latestVideo ? (
                <div 
                  className="relative rounded-xl overflow-hidden cursor-pointer group w-full h-44 bg-slate-900/80 border border-slate-700"
                  onClick={handleOpenVideo}
                 >
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 z-10 transition-all duration-300">
                        <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 shadow-red-500/40 transition-transform">
                           <div className="w-0 h-0 border-t-8 border-t-transparent border-l-[14px] border-l-white border-b-8 border-b-transparent ml-1"></div>
                        </div>
                     </div>
                     <img src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=600&auto=format&fit=crop" alt="Thumbnail" className="object-cover w-full h-full opacity-60 group-hover:opacity-80 transition-opacity" />
                </div>
             ) : (
                <div className="w-full h-44 bg-slate-900/80 border border-slate-700 rounded-xl flex items-center justify-center">
                   <p className="text-slate-500 text-sm">Poste um vídeo para aparecer aqui.</p>
                </div>
             )}
          </div>

        </div>
      </div>

      {/* Modal / Popup de Confirmação Flutuante */}
      {showVideoModal && latestVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-slate-800 p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-700 m-4">
              <h3 className="text-xl font-bold text-white mb-2">Abrir Vídeo</h3>
              <p className="text-slate-300 text-sm mb-6">
                Deseja ser redirecionado para assistir ao vídeo <strong>{latestVideo.title}</strong> no {latestVideo.platform || 'navegador'}?
              </p>
              <div className="flex gap-3 justify-end">
                 <button 
                  onClick={() => setShowVideoModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 font-medium transition"
                 >
                   Cancelar
                 </button>
                 <button 
                  onClick={confirmOpenVideo}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 font-medium shadow-lg shadow-red-500/20 transition flex items-center gap-2"
                 >
                   Assistir Agora
                 </button>
              </div>
           </div>
        </div>
      )}

    </Sidebar>
  );
}
