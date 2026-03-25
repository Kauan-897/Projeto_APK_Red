import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { Users, CalendarDays, Video, TrendingUp, Calendar as CalendarIcon, FileText, Plus, Trash2, PieChart, Activity, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserDashboard() {
  const navigate = useNavigate();
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

  // Funcionalidades do Dashboard Ref
  const [demographics, setDemographics] = useState({ males: 0, females: 0, ageGroups: {} });
  const [recentSignups, setRecentSignups] = useState([]);
  const [personalNotes, setPersonalNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

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

      // --- NOVOS DADOS DASHBOARD ---
      const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, email, gender, birth_date, created_at, avatar_url').eq('church_id', churchId);
      
      let males = 0, females = 0;
      let ageGroups = { '0-12': 0, '13-17': 0, '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 };

      if (allProfiles) {
         allProfiles.forEach(p => {
             if (p.gender === 'M') males++;
             else if (p.gender === 'F') females++;

             if (p.birth_date) {
                 const age = new Date().getFullYear() - new Date(p.birth_date).getFullYear();
                 if (age <= 12) ageGroups['0-12']++;
                 else if (age <= 17) ageGroups['13-17']++;
                 else if (age <= 25) ageGroups['18-25']++;
                 else if (age <= 40) ageGroups['26-40']++;
                 else if (age <= 60) ageGroups['41-60']++;
                 else ageGroups['60+']++;
             }
         });
         
         const sortedSignups = [...allProfiles].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
         setRecentSignups(sortedSignups.slice(0, 5));
      }
      setDemographics({ males, females, ageGroups });

      // Anotações Pessoais
      const { data: notesData } = await supabase.from('personal_notes').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false });
      if (notesData) setPersonalNotes(notesData);
      // -----------------------------

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

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const { data, error } = await supabase.from('personal_notes').insert([{ profile_id: profile.id, church_id: profile.church_id, content: newNote.trim() }]).select();
    if (!error && data) {
       setPersonalNotes([data[0], ...personalNotes]);
       setNewNote('');
    } else {
       toast.error("Erro. Rode o novo script 'supabase_dashboard_features.sql' no Supabase para ativar anotações!");
    }
  };

  const handleDeleteNote = async (id) => {
     await supabase.from('personal_notes').delete().eq('id', id);
     setPersonalNotes(personalNotes.filter(n => n.id !== id));
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
        {/* Esquerda: Demografia, Atividades e Notas (2 Cols) */}
        <div className="col-span-1 lg:col-span-2 space-y-8">
          
          {/* Nova Seção: Demografia (Homens/Mulheres) - Enuves Ref */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg relative">
             <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><PieChart className="w-5 h-5 text-indigo-400"/> Perfil Demográfico</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sexo */}
                <div>
                   <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase">Homens vs Mulheres</h4>
                   {demographics.males === 0 && demographics.females === 0 ? (
                      <div className="text-sm text-slate-500">Nenhum dado de gênero preenchido.</div>
                   ) : (
                      <div className="space-y-3">
                         <div className="w-full bg-slate-700/50 rounded-full h-5 flex overflow-hidden ring-1 ring-slate-700">
                           <div style={{ width: `${(demographics.males / (demographics.males + demographics.females)) * 100}%` }} className="bg-gradient-to-r from-blue-600 to-blue-500 h-full relative group"><span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{Math.round((demographics.males / (demographics.males + demographics.females)) * 100)}%</span></div>
                           <div style={{ width: `${(demographics.females / (demographics.males + demographics.females)) * 100}%` }} className="bg-gradient-to-r from-pink-500 to-pink-400 h-full relative group"><span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{Math.round((demographics.females / (demographics.males + demographics.females)) * 100)}%</span></div>
                         </div>
                         <div className="flex justify-between text-sm">
                            <span className="text-blue-400 font-bold">{demographics.males} Homens</span>
                            <span className="text-pink-400 font-bold">{demographics.females} Mulheres</span>
                         </div>
                      </div>
                   )}
                </div>

                {/* Faixa Etária */}
                <div>
                  <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase">Faixa Etária</h4>
                  {Object.values(demographics.ageGroups).every(v => v === 0) ? (
                     <div className="text-sm text-slate-500">Nenhum dado de idade preenchido.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(demographics.ageGroups).map(([range, count]) => {
                         if(count === 0) return null;
                         return (
                            <div key={range} className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
                               <span className="text-xs text-slate-400">{range} anos</span>
                               <span className="text-sm font-bold text-white">{count}</span>
                            </div>
                         );
                      })}
                    </div>
                  )}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Minhas Anotações - Enuves Ref */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg flex flex-col h-[400px]">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-amber-400"/> Minhas Anotações</h3>
              <form onSubmit={handleAddNote} className="mb-4 flex gap-2">
                 <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Ideias, recados rápidos..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none" />
                 <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-lg shrink-0"><Plus className="w-5 h-5"/></button>
              </form>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                 {personalNotes.length > 0 ? (
                    personalNotes.map(note => (
                       <div key={note.id} className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 group flex justify-between items-start gap-3 relative">
                          <p className="text-sm text-amber-200/80 font-medium whitespace-pre-wrap">{note.content}</p>
                          <button onClick={() => handleDeleteNote(note.id)} className="text-amber-500/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition shrink-0 bg-slate-900/50 p-1.5 rounded-md absolute top-2 right-2"><Trash2 className="w-4 h-4"/></button>
                       </div>
                    ))
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                       <FileText className="w-8 h-8 mb-2" />
                       <span className="text-sm font-medium">Nenhuma anotação</span>
                    </div>
                 )}
              </div>
            </div>

            {/* Atividades Recentes do Sistema */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg h-[400px] overflow-hidden flex flex-col">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400"/> Atividade Geral</h3>
              <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-2">
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
                  <p className="text-sm text-slate-500 text-center py-4">Nenhuma atividade recente.</p>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Direita: Eventos na Agenda e Últimos Cadastros (1 Col) */}
        <div className="space-y-8">
          
          {/* Cadastros Recentes - Enuves Ref */}
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-white flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400"/> Cadastros Recentes</h3>
             </div>
             <div className="space-y-3">
                {recentSignups.length > 0 ? (
                   recentSignups.map((usr) => (
                      <div key={usr.id} className="flex gap-3 items-center p-3 rounded-xl bg-slate-900/50 border border-slate-800/50">
                        <div className="bg-slate-700 text-slate-400 w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                           {usr.avatar_url ? <img src={usr.avatar_url} alt="" className="w-full h-full object-cover"/> : <Users className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-white text-sm truncate">{usr.full_name || 'Sem Nome'}</h4>
                           <p className="text-xs text-slate-500 truncate">{formatTimeAgo(new Date(usr.created_at))}</p>
                        </div>
                      </div>
                   ))
                ) : (
                  <div className="text-center py-4">
                     <p className="text-sm text-slate-500">Nenhum membro recente.</p>
                  </div>
                )}
             </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-white flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-red-500"/> Agenda de Eventos</h3>
               {upcomingEvents.length > 0 && <button onClick={() => navigate('/eventos')} className="text-sm text-red-500 hover:text-red-400 font-medium transition">Ver +</button>}
             </div>
             <div className="space-y-4">
                {upcomingEvents.length > 0 ? (
                   upcomingEvents.map((evt) => (
                      <div key={evt.id} className="flex gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 border-l-2 border-l-red-500">
                        <div className="flex-1">
                           <h4 className="font-bold text-white text-sm line-clamp-1">{evt.title}</h4>
                           <p className="text-xs text-red-400 font-medium mb-1 mt-1">{evt.date.split('-').reverse().join('/')} {evt.time ? `às ${evt.time.substring(0,5)}` : ''}</p>
                        </div>
                      </div>
                   ))
                ) : (
                  <div className="text-center py-4">
                     <p className="text-sm text-slate-500">Nenhum evento agendado.</p>
                  </div>
                )}
             </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-lg hidden lg:block">
             <div className="flex items-center gap-2 mb-4">
               <h3 className="text-xl font-bold text-white text-wrap break-words line-clamp-1">{latestVideo?.title || 'Dica / Tutorial'}</h3>
               {latestVideo && <span className="inline-block bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0">Útil</span>}
             </div>
             {latestVideo ? (
                <div className="relative rounded-xl overflow-hidden cursor-pointer group w-full h-32 bg-slate-900/80 border border-slate-700" onClick={handleOpenVideo}>
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 z-10 transition-all duration-300">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 shadow-red-500/40 transition-transform">
                           <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
                        </div>
                     </div>
                     <img src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=600&auto=format&fit=crop" alt="Thumbnail" className="object-cover w-full h-full opacity-60 group-hover:opacity-80 transition-opacity" />
                </div>
             ) : (
                <div className="w-full h-32 bg-slate-900/80 border border-slate-700 rounded-xl flex items-center justify-center">
                   <p className="text-slate-500 text-sm">Nenhum vídeo salvo.</p>
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
