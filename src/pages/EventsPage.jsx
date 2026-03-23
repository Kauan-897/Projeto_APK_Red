import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { CalendarDays, List, Plus, MapPin, AlignLeft, Clock, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventsPage() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState('calendario'); // 'calendario' | 'lista'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Controle do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventDetailsModal, setEventDetailsModal] = useState(null);

  // States do Formulário
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');

  // Permissões
  const authorizedRoles = ['pastor', 'lider_homem', 'lider_mulher', 'supervisor', 'desenvolvedor'];
  const canManage = authorizedRoles.includes(profile?.role);

  // Calendário Params
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (profile?.church_id) {
      fetchEvents();
    }
  }, [profile]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('church_id', profile.church_id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) toast.error('Erro ao buscar eventos.');
    else setEvents(data || []);
    setLoading(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!title || !date) return toast.error('Título e data de início são obrigatórios!');
    
    // Tratamento basico da string de input de date para salvar no DB corretamente formatado
    let dtFormated = date;
    let dtEndFormated = endDate || date; 

    const newEvent = {
       church_id: profile.church_id,
       title,
       date: dtFormated,
       time: isAllDay ? '00:00' : (time || '00:00'),
       end_date: dtEndFormated,
       end_time: isAllDay ? '23:59' : (endTime || time || '23:59'),
       is_all_day: isAllDay,
       location,
       description,
       color
    };

    const { error } = await supabase.from('events').insert([newEvent]);
    
    if (error) {
       toast.error('Erro ao salvar evento: ' + error.message);
    } else {
       toast.success('Evento salvo com sucesso!');
       setIsModalOpen(false);
       resetForm();
       fetchEvents();
    }
  };

  const handleDelete = async (id) => {
      if (!window.confirm("Deseja mesmo apagar este evento?")) return;
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) toast.error("Erro ao deletar");
      else {
          toast.success("Deletado com sucesso");
          setEventDetailsModal(null);
          fetchEvents();
      }
  }

  const resetForm = () => {
    setTitle(''); setDate(''); setTime(''); setEndDate(''); setEndTime(''); setIsAllDay(false); setLocation(''); setDescription(''); setColor('blue');
  };

  // ----- Funções Auxiliares do Calendario -----
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const renderCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    let blanks = [];
    for (let i = 0; i < firstDay; i++) {
        blanks.push(<div key={`b-${i}`} className="h-28 border border-slate-800 bg-slate-900/30 rounded-lg opacity-30"></div>);
    }

    let daysInMonthElements = [];
    for (let d = 1; d <= daysInMonth; d++) {
        // Formatar para comparar YYYY-MM-DD
        const dStr = String(d).padStart(2, '0');
        const mStr = String(month + 1).padStart(2, '0');
        const searchDate = `${year}-${mStr}-${dStr}`;
        const dayEvents = events.filter(e => e.date === searchDate);

        daysInMonthElements.push(
            <div key={d} className="h-28 border border-slate-700/50 bg-slate-800 rounded-lg p-2 overflow-y-auto custom-scrollbar flex flex-col gap-1 transition hover:border-slate-600">
                <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                     new Date().toISOString().split('T')[0] === searchDate ? 'bg-red-500 text-white' : 'text-slate-400'
                }`}>
                    {d}
                </span>
                {dayEvents.map(evt => (
                    <div 
                      key={evt.id} 
                      onClick={() => setEventDetailsModal(evt)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate cursor-pointer transition 
                        ${evt.color === 'red' ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/40' : 
                          evt.color === 'green' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 hover:bg-emerald-500/40' :
                          evt.color === 'amber' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 hover:bg-amber-500/40' :
                          'bg-blue-500/20 text-blue-500 border border-blue-500/40 hover:bg-blue-500/40'
                        }`
                      }
                    >
                        {!evt.is_all_day && <span>{evt.time?.substring(0,5)} - </span>}
                        {evt.title}
                    </div>
                ))}
            </div>
        );
    }
    return [...blanks, ...daysInMonthElements];
  };

  const getGoogleCalendarLink = (evt) => {
    try {
      const formatDateTime = (dStr, tStr) => {
          if (!dStr) return '';
          // O Postgres pode retornar a hora como "07:00:00". Precisamos apenas do HH:MM (5 caracteres).
          const timePart = (tStr || '00:00').substring(0, 5);
          const dateObj = new Date(`${dStr}T${timePart}:00Z`);
          if (isNaN(dateObj.getTime())) return ''; // Protege contra Invalid Date
          return dateObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
      };
      const dtStart = formatDateTime(evt.date, evt.time);
      const dtEnd = evt.is_all_day ? dtStart : formatDateTime(evt.end_date || evt.date, evt.end_time || evt.time);

      let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title || 'Evento')}`;
      if (dtStart) url += `&dates=${dtStart}/${dtEnd || dtStart}`;
      if (evt.description) url += `&details=${encodeURIComponent(evt.description)}`;
      if (evt.location) url += `&location=${encodeURIComponent(evt.location)}`;
      return url;
    } catch (err) {
      console.error("Erro gerando link do calendário:", err);
      return "#";
    }
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const changeMonth = (diff) => {
      const newD = new Date(currentDate.getFullYear(), currentDate.getMonth() + diff, 1);
      setCurrentDate(newD);
  }

  if (loading) {
      return <Sidebar><div className="flex items-center justify-center text-slate-400 h-full">Carregando eventos...</div></Sidebar>
  }

  return (
    <Sidebar>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Eventos</h1>
          <p className="text-slate-400">Gerencie e visualize a agenda da sua igreja</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 w-full md:w-auto">
                <button 
                  onClick={() => setViewMode('calendario')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${viewMode === 'calendario' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <CalendarDays className="w-4 h-4" /> Calendário
                </button>
                <button 
                  onClick={() => setViewMode('lista')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${viewMode === 'lista' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <List className="w-4 h-4" /> Lista
                </button>
            </div>
            {canManage && (
                <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition shadow-lg shadow-red-500/20 whitespace-nowrap flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Novo Evento
                </button>
            )}
        </div>
      </div>

      {viewMode === 'calendario' ? (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Calendário de Eventos</h3>
                  <p className="text-xs text-slate-400 mt-1">Cores: Culto (Vermelho), PGs/Reunião (Amarelo), Estudos (Verde), Outros/Geral (Azul)</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-900 rounded-lg border border-slate-700 text-slate-400 hover:text-white">&lt;</button>
                    <span className="font-bold text-white min-w-32 text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                    <button onClick={() => changeMonth(1)} className="p-2 bg-slate-900 rounded-lg border border-slate-700 text-slate-400 hover:text-white">&gt;</button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-medium text-slate-400 uppercase">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
            </div>
            <div className="grid grid-cols-7 gap-2">
               {renderCalendarGrid()}
            </div>
        </div>
      ) : (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
           <h3 className="text-xl font-bold text-white mb-6">Lista de Eventos (Próximos)</h3>
           {events.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {events.filter(e => e.date >= new Date().toISOString().split('T')[0]).map(evt => (
                    <div key={evt.id} className="bg-slate-900 border border-slate-700 p-5 rounded-xl flex flex-col hover:border-slate-500 transition cursor-pointer" onClick={() => setEventDetailsModal(evt)}>
                        <div className="flex justify-between items-start mb-3">
                            <span className={`w-3 h-3 rounded-full mt-1 ${evt.color === 'red' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : evt.color === 'amber' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : evt.color === 'green' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}></span>
                            <span className="bg-slate-800 text-slate-300 text-[10px] uppercase font-bold px-2 py-1 rounded">{evt.date.split('-').reverse().join('/')}</span>
                        </div>
                        <h4 className="font-bold text-white text-lg leading-tight mb-2 line-clamp-2">{evt.title}</h4>
                        {evt.location && <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><MapPin className="w-3 h-3"/> <span className="truncate">{evt.location}</span></div>}
                        <div className="flex items-center gap-2 text-slate-400 text-xs mt-auto pt-4 border-t border-slate-800"><Clock className="w-3 h-3"/> {!evt.is_all_day ? `${evt.time?.substring(0,5)} até ${evt.end_time?.substring(0,5)}` : 'Dia Inteiro'}</div>
                    </div>
                 ))}
               </div>
           ) : (
             <div className="py-20 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                 <CalendarDays className="w-16 h-16 mb-4 opacity-30" />
                 <h4 className="text-lg font-bold text-white">Nenhum evento encontrado</h4>
                 <p className="text-sm">Os eventos da agenda aparecerão aqui.</p>
             </div>
           )}
        </div>
      )}

      {/* Modal - Detalhes do Evento (Visualização) */}
      {eventDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
              <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
                  <div className={`h-24 w-full relative ${eventDetailsModal.color === 'red' ? 'bg-red-500/20' : eventDetailsModal.color === 'amber' ? 'bg-amber-500/20' : eventDetailsModal.color === 'green' ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                      <button onClick={() => setEventDetailsModal(null)} className="absolute top-4 right-4 bg-slate-900/50 p-2 rounded-full hover:bg-slate-900 text-white transition"><X className="w-5 h-5"/></button>
                      <div className="absolute -bottom-6 left-6 w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border-4 border-[#1e293b] shadow-lg">
                          <span className={`w-4 h-4 rounded-full ${eventDetailsModal.color === 'red' ? 'bg-red-500' : eventDetailsModal.color === 'amber' ? 'bg-amber-500' : eventDetailsModal.color === 'green' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                      </div>
                  </div>
                  <div className="p-6 pt-10">
                      <h2 className="text-2xl font-bold text-white mb-4 leading-tight">{eventDetailsModal.title}</h2>
                      
                      <div className="space-y-4 text-slate-300 text-sm">
                          <div className="flex gap-4">
                              <CalendarDays className="w-5 h-5 shrink-0 text-slate-400" />
                              <div>
                                  <p>{new Date(eventDetailsModal.date + 'T00:00:00').toLocaleDateString('pt-BR', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
                                  <p className="text-slate-400 mt-1">{eventDetailsModal.is_all_day ? 'O dia inteiro' : `${eventDetailsModal.time?.substring(0,5)} – ${eventDetailsModal.end_time?.substring(0,5)}`}</p>
                              </div>
                          </div>
                          {eventDetailsModal.location && (
                              <div className="flex items-start gap-4">
                                  <MapPin className="w-5 h-5 shrink-0 text-slate-400" />
                                  <p>{eventDetailsModal.location}</p>
                              </div>
                          )}
                          {eventDetailsModal.description && (
                              <div className="flex items-start gap-4">
                                  <AlignLeft className="w-5 h-5 shrink-0 text-slate-400" />
                                  <p className="whitespace-pre-wrap leading-relaxed">{eventDetailsModal.description}</p>
                              </div>
                          )}
                      </div>

                      <div className="mt-8 flex gap-3 flex-wrap">
                          <a href={getGoogleCalendarLink(eventDetailsModal)} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg border border-slate-700 transition">
                              Salvar no Google Agenda <ExternalLink className="w-4 h-4"/>
                          </a>
                          {canManage && (
                              <button onClick={() => handleDelete(eventDetailsModal.id)} className="flex items-center gap-2 bg-transparent hover:bg-red-900/30 text-red-500 font-medium py-2 px-4 rounded-lg transition border border-transparent hover:border-red-900/50">
                                  Remover Evento
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal - Criação (Estilo Google Calendar) */}
      {isModalOpen && canManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
              <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl shadow-xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Header Form */}
                  <div className="bg-slate-900/50 p-4 border-b border-slate-800 flex justify-between items-center">
                     <h3 className="text-white font-bold px-2">Criar Novo Evento</h3>
                     <button onClick={() => {setIsModalOpen(false); resetForm();}} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition"><X className="w-4 h-4"/></button>
                  </div>

                  {/* Body Form */}
                  <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                      
                      {/* Titulo Grande */}
                      <input 
                         type="text" 
                         value={title} onChange={(e) => setTitle(e.target.value)} required
                         placeholder="Adicionar título" 
                         className="w-full bg-transparent border-b border-slate-700 focus:border-red-500 pb-2 text-2xl font-medium text-white placeholder:text-slate-500 outline-none transition"
                      />

                      {/* Faixa de Datas */}
                      <div className="flex flex-col gap-4 bg-slate-900/30 p-4 rounded-xl border border-slate-800">
                         <div className="flex gap-4 items-center mb-2">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                                <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} className="accent-red-500" /> Dia Inteiro
                            </label>
                         </div>
                         
                         <div className="flex grid-cols-2 md:grid-cols-4 gap-4 w-full">
                            <div className="flex flex-col flex-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Início (Data)</label>
                                <input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                            </div>
                            {!isAllDay && (
                                <div className="flex flex-col flex-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Início (Hora)</label>
                                    <input type="time" value={time} onChange={e=>setTime(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                                </div>
                            )}
                            <div className="flex flex-col flex-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Fim (Data)</label>
                                <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                            </div>
                            {!isAllDay && (
                                <div className="flex flex-col flex-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Fim (Hora)</label>
                                    <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                                </div>
                            )}
                         </div>
                      </div>

                      {/* Locais e Detalhes */}
                      <div className="space-y-4">
                          <div className="flex gap-4 items-start">
                             <MapPin className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
                             <input type="text" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Adicionar local" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-red-500 transition" />
                          </div>
                          
                          <div className="flex gap-4 items-start">
                             <AlignLeft className="w-5 h-5 text-slate-400 mt-2 shrink-0" />
                             <textarea rows="3" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Adicionar descrição ou observações" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-red-500 transition resize-none custom-scrollbar" />
                          </div>
                      </div>

                      {/* Cor do Evento */}
                      <div className="flex gap-4 items-center pl-9">
                          <span className="text-sm text-slate-400 block w-24">Cor da Tag:</span>
                          <div className="flex gap-3">
                              {['red', 'amber', 'green', 'blue'].map(c => (
                                  <button 
                                      type="button" 
                                      key={c} 
                                      onClick={() => setColor(c)}
                                      className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${
                                          c === 'red' ? 'bg-red-500' : c === 'amber' ? 'bg-amber-500' : c === 'green' ? 'bg-emerald-500' : 'bg-blue-500'
                                      } ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e293b] scale-110' : 'opacity-50 hover:opacity-100'}`}
                                  >
                                      {color === c && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Botoes Form */}
                      <div className="pt-6 border-t border-slate-800 flex justify-end gap-3 mt-8">
                         <button type="button" onClick={() => {setIsModalOpen(false); resetForm();}} className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition">Cancelar</button>
                         <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 transition">Salvar</button>
                      </div>

                  </form>
              </div>
          </div>
      )}

    </Sidebar>
  );
}
