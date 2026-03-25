import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { ArrowLeft, ClipboardList, Plus, CalendarClock, Users, MapPin, X, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SchedulesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [allSchedules, setAllSchedules] = useState([]);
  const [mySchedules, setMySchedules] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  
  // View Details Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState(null);

  // Creation Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleMaxVolunteers, setScheduleMaxVolunteers] = useState('');
  const [assignedMembers, setAssignedMembers] = useState([]);
  
  const canManage = ['desenvolvedor', 'pastor', 'admin', 'lider_homem', 'lider_mulher', 'supervisor'].includes(profile?.role);

  useEffect(() => {
    if (profile?.church_id) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sData, error: sErr } = await supabase.from('schedules').select('*').eq('church_id', profile.church_id).order('date', { ascending: true });
      const { data: smData, error: smErr } = await supabase.from('schedule_members').select(`id, schedule_id, role_name, status, profile:profiles(id, full_name)`);

      if (!sErr && sData) {
         const schedulesWithMembers = sData.map(sched => ({
             ...sched,
             members: smData?.filter(sm => sm.schedule_id === sched.id) || []
         }));
         setAllSchedules(schedulesWithMembers);

         const mine = schedulesWithMembers.filter(sched => sched.members.some(sm => sm.profile.id === profile.id));
         setMySchedules(mine);

         // Aggiorna o state do modal se ele estiver aberto para vermos as mudanças ao vivo
         if (viewingSchedule) {
             const updated = schedulesWithMembers.find(s => s.id === viewingSchedule.id);
             if (updated) setViewingSchedule(updated);
         }
      }

      if (canManage) {
         const { data: membersData, error: errMembers } = await supabase.from('profiles').select('id, full_name').eq('church_id', profile.church_id).order('full_name');
         if (errMembers) {
             toast.error("Erro no RLS de perfis: " + errMembers.message + ". Execute o script supabase_profiles_rls_fix.sql no BD.");
         }
         if (membersData) setAllMembers(membersData);
      }
    } catch (err) {
      console.log("Erro de tabelas", err);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (scheduleMemberId, newStatus) => {
     const { data, error } = await supabase.from('schedule_members').update({ status: newStatus }).eq('id', scheduleMemberId).select();
     if (error) toast.error("Erro: " + error.message);
     else if (!data || data.length === 0) toast.error("Sem permissão para atualizar esse status. O script SQL do banco foi rodado?");
     else { toast.success(newStatus === 'confirmado' ? "Você confirmou o convite!" : "Status atualizado!"); fetchData(); }
  };

  const handleRemoveMember = async (scheduleMemberId) => {
      if (!window.confirm("Deseja realmente remover/recusar esta pessoa?")) return;
      const { data, error } = await supabase.from('schedule_members').delete().eq('id', scheduleMemberId).select();
      if (error) toast.error("Erro: " + error.message);
      else if (!data || data.length === 0) toast.error("Erro de Permissão ao remover.");
      else { toast.success("Participante removido com sucesso."); fetchData(); }
  };

  const handleVolunteer = async (schedule) => {
     // BARRAMENTO DE CONFLITO!
     // Verifica se eu já estou em outra escala NESSA data E horário exatamente
     const conflict = mySchedules.find(m => m.date === schedule.date && m.time === schedule.time && m.id !== schedule.id);
     if (conflict) {
         return toast.error(`Aviso: Você já está participando do evento "${conflict.title}" no mesmo dia e horário!`);
     }

     const newMember = { schedule_id: schedule.id, profile_id: profile.id, role_name: 'Participante', status: 'aguardando_lider' };
     const { error } = await supabase.from('schedule_members').insert([newMember]);
     
     if (error) {
         toast.error(error.message.includes("unique") ? "Você já está nesta escala." : "Erro ao se voluntariar: " + error.message);
     } else {
         toast.success("Pedido enviado! Aguardando aprovação da liderança.");
         fetchData();
     }
  };

  const handleCancelParticipation = async (scheduleId) => {
      if (!window.confirm("Deseja realmente cancelar sua participação nesta escala?")) return;
      const { data, error } = await supabase.from('schedule_members').delete().match({ schedule_id: scheduleId, profile_id: profile.id }).select();
      
      if (error) {
          toast.error(error.message.includes("policy") ? "Adicione e rode o script SQL para permitir a remoção." : "Erro: " + error.message);
      } else if (!data || data.length === 0) {
          toast.error("Erro de Permissão: Rode o script 'supabase_schedules_master_fix.sql' no Supabase para permitir o cancelamento.");
      } else {
          toast.success("Participação cancelada com sucesso.");
          fetchData();
      }
  };

  const handleDeleteSchedule = async (scheduleId) => {
      if (!window.confirm("Deseja excluir permanentemente esta escala?")) return;
      const { error } = await supabase.from('schedules').delete().eq('id', scheduleId);
      if (error) toast.error("Erro ao apagar: " + error.message);
      else {
          toast.success("Escala apagada.");
          setIsViewModalOpen(false);
          fetchData();
      }
  };

  const handleCreateSchedule = async (e) => {
      e.preventDefault();
      if (!scheduleTitle || !scheduleDate || !scheduleTime) return toast.error("Preencha todos os campos obrigatórios da escala.");
      
      const missingRoles = assignedMembers.some(am => !am.profile_id || !am.role_name);
      if (missingRoles) return toast.error("Preencha a pessoa e a função de todos os escalados.");

      const newSchedule = {
          church_id: profile.church_id, title: scheduleTitle, date: scheduleDate, time: scheduleTime,
          location: scheduleLocation || null, max_volunteers: scheduleMaxVolunteers ? parseInt(scheduleMaxVolunteers) : null
      };

      const { data: insertedSchedule, error: errScale } = await supabase.from('schedules').insert([newSchedule]).select().single();
      if (errScale) return toast.error(errScale.message.includes("relation") ? "Tabela não encontrada. Rode o SQL." : "Erro ao criar: " + errScale.message);

      if (assignedMembers.length > 0) {
          const membersToInsert = assignedMembers.map(am => ({
              schedule_id: insertedSchedule.id, profile_id: am.profile_id, role_name: am.role_name, status: 'pendente'
          }));
          const { error: errMembers } = await supabase.from('schedule_members').insert(membersToInsert);
          if (errMembers) toast.error("Erro ao adicionar alguns membros: " + errMembers.message);
      }

      toast.success("Escala criada com sucesso!");
      setIsModalOpen(false);
      setScheduleTitle(''); setScheduleDate(''); setScheduleTime(''); setScheduleLocation(''); setScheduleMaxVolunteers(''); setAssignedMembers([]);
      fetchData();
  };

  const addAssignedMemberSlot = () => setAssignedMembers([...assignedMembers, { profile_id: '', role_name: '' }]);
  const removeAssignedMemberSlot = (index) => {
      const newArr = [...assignedMembers];
      newArr.splice(index, 1);
      setAssignedMembers(newArr);
  };
  const updateAssignedMember = (index, field, value) => {
      const newArr = [...assignedMembers];
      newArr[index][field] = value;
      setAssignedMembers(newArr);
  };

  const getGoogleCalendarLink = (sched) => {
     const startDate = sched.date.replace(/-/g, '');
     const startTime = (sched.time.length === 5 ? sched.time + ':00' : sched.time).substring(0,5).replace(':', '') + '00';
     const dateStr = `${startDate}T${startTime}/${startDate}T${startTime}`; 
     return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(sched.title)}&dates=${dateStr}&details=Adicionado+via+Igreja+Digital${sched.location ? '&location=' + encodeURIComponent(sched.location) : ''}`;
  }

  const openScheduleDetails = (sched) => {
      setViewingSchedule(sched);
      setIsViewModalOpen(true);
  };

  if (loading) return <Sidebar><div className="flex items-center justify-center text-slate-400 h-full">Carregando dados...</div></Sidebar>;

  return (
    <Sidebar>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Escalas e Atribuições</h1>
            <p className="text-sm text-slate-400">Marque presença, voluntarie-se ou gerencie escalas</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-500/20 transition w-full md:w-auto justify-center"><Plus className="w-4 h-4"/> Criar Nova Escala</button>
        )}
      </div>

      <div className="space-y-12">
          {/* Minhas Escalas */}
          <section>
              <h2 className="text-xl font-bold text-white mb-4">Minhas Escalas</h2>
              {mySchedules.length > 0 ? (
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {mySchedules.map(sched => {
                       const myRole = sched.members.find(sm => sm.profile.id === profile.id);
                       return (
                           <div key={sched.id} onClick={() => openScheduleDetails(sched)} className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-5 flex flex-col xl:flex-row gap-5 items-start xl:items-center justify-between hover:border-slate-500 transition cursor-pointer">
                                <div className="flex items-start gap-4">
                                     <div className="bg-red-500/10 text-red-500 p-3 rounded-xl border border-red-500/20 shrink-0"><CalendarClock className="w-6 h-6" /></div>
                                     <div>
                                         <h3 className="font-bold text-white text-lg leading-tight mb-1">{sched.title}</h3>
                                         <p className="text-slate-400 text-sm mt-0.5">{sched.date.split('-').reverse().join('/')} às {sched.time.substring(0,5)}</p>
                                         <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <a href={getGoogleCalendarLink(sched)} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-2 py-1.5 rounded inline-flex items-center gap-1.5 transition whitespace-nowrap" onClick={(e) => e.stopPropagation()}><CalendarClock className="w-3.5 h-3.5" /> Adicionar na Agenda</a>
                                            {sched.location && <span className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-1.5 rounded inline-flex items-center gap-1.5 text-slate-400 max-w-[200px] truncate" title={sched.location}><MapPin className="w-3.5 h-3.5" /> {sched.location}</span>}
                                         </div>
                                         <div className="mt-4 inline-block px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-300">Função/Status: <span className="text-white font-bold">{myRole?.role_name}</span></div>
                                     </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-start sm:justify-end gap-2 w-full xl:w-auto mt-4 xl:mt-0 pt-4 xl:pt-0 border-t xl:border-0 border-slate-700">
                                      {myRole?.status === 'pendente' && (
                                          <><button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(myRole.id, 'confirmado'); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-sm font-bold transition w-full whitespace-nowrap"><CheckCircle className="w-4 h-4"/> Confirmar Convite</button></>
                                      )}
                                      {myRole?.status === 'aguardando_lider' && (
                                          <span className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-sm font-bold w-full whitespace-nowrap">Aguardando Aprovação</span>
                                      )}
                                      {myRole?.status === 'confirmado' && (
                                          <span className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg text-sm font-bold w-full whitespace-nowrap"><CheckCircle className="w-4 h-4"/> Confirmada</span>
                                      )}
                                      <button onClick={(e) => { e.stopPropagation(); handleCancelParticipation(sched.id); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition w-full whitespace-nowrap"><XCircle className="w-4 h-4"/> {myRole?.status === 'pendente' ? 'Recusar Convite' : myRole?.status === 'aguardando_lider' ? 'Cancelar Pedido' : 'Sair'}</button>
                                 </div>
                           </div>
                       )
                    })}
                 </div>
              ) : (
                 <div className="bg-slate-800/30 rounded-2xl border border-slate-800/50 h-32 flex flex-col items-center justify-center text-slate-500"><ClipboardList className="w-10 h-10 mb-2 opacity-50 stroke-[1.5]" /><p className="text-sm font-medium">Você não está escalado no momento</p></div>
              )}
          </section>

          {/* Todas as Escalas */}
          <section>
              <h2 className="text-xl font-bold text-white mb-4">Mural de Vagas e Escalas Abertas</h2>
              {allSchedules.length > 0 ? (
                 <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allSchedules.map(sched => {
                         const amIVolunteered = sched.members.some(sm => sm.profile.id === profile.id);
                         const isFull = sched.max_volunteers !== null && sched.members.length >= sched.max_volunteers;
                         
                         return (
                           <div key={sched.id} onClick={() => openScheduleDetails(sched)} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition flex flex-col justify-between shadow-lg cursor-pointer">
                                <div className="flex flex-col mb-4 gap-2">
                                    <h3 className="font-bold text-white text-lg leading-tight">{sched.title}</h3>
                                    <p className="text-slate-400 text-sm">{sched.date.split('-').reverse().join('/')} às {sched.time.substring(0,5)}</p>
                                    
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <div className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-[10px] font-bold text-slate-300 flex items-center gap-1.5 shrink-0"><Users className="w-3 h-3 text-slate-500"/> {sched.members.length} {sched.max_volunteers ? `/ ${sched.max_volunteers}` : 'Pessoas'}</div>
                                        {sched.location && <div className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-[10px] items-center gap-1 text-slate-400 truncate max-w-[120px]" title={sched.location}><MapPin className="w-3 h-3 inline-block mr-1 -mt-0.5" /> {sched.location}</div>}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-700 flex flex-col gap-2">
                                    {sched.members.slice(0,3).map(sm => (
                                        <div key={sm.id} className="flex items-center justify-between text-[11px] bg-slate-900/40 p-1.5 rounded-lg border border-slate-700/30">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <div className="w-5 h-5 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center border border-slate-600 shrink-0">{sm.profile.full_name?.charAt(0)}</div>
                                                <span className="truncate max-w-[100px]">{sm.profile.full_name}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {sched.members.length > 3 && <div className="text-[10px] text-slate-500 mt-1 font-medium text-center">E mais {sched.members.length - 3} pessoa(s)...</div>}
                                    {sched.members.length === 0 && <div className="text-xs text-slate-500 italic text-center py-2">Nenhum voluntário escalado ainda.</div>}
                                </div>

                                {/* Botão Rápido de Participar */}
                                {!amIVolunteered && (
                                   <div className="mt-4 pt-4 border-t border-slate-700/50">
                                      <button onClick={(e) => { e.stopPropagation(); handleVolunteer(sched); }} disabled={isFull} className={`w-full py-2.5 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2 ${isFull ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'}`}>
                                         {isFull ? 'Vagas Esgotadas' : <><CheckCircle className="w-4 h-4"/> Pedir para Participar</>}
                                      </button>
                                   </div>
                                )}
                                {amIVolunteered && (
                                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col items-center justify-center gap-2">
                                        {(() => {
                                           const myRole = sched.members.find(sm => sm.profile.id === profile.id);
                                           return myRole?.status === 'aguardando_lider' 
                                            ? <span className="text-amber-500 text-xs font-bold flex items-center gap-2">Pedido Aguardando Aprovação</span>
                                            : myRole?.status === 'pendente' 
                                              ? <span className="text-amber-500 text-xs font-bold flex items-center gap-2">Convite Pendente</span>
                                              : <span className="text-emerald-500 text-xs font-bold flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Confirmado nesta escala</span>
                                        })()}
                                    </div>
                                )}
                           </div>
                         )
                    })}
                 </div>
              ) : (
                 <div className="bg-slate-800/30 rounded-2xl border border-slate-800/50 h-56 flex flex-col items-center justify-center text-slate-500"><ClipboardList className="w-12 h-12 mb-4 opacity-50 stroke-[1.5]" /><p className="text-sm font-medium">Nenhuma escala ou vaga criada ainda</p></div>
              )}
          </section>
      </div>

      {/* Modal DETALHES DA ESCALA (Onde mostra todo mundo e permite cancelar) */}
      {isViewModalOpen && viewingSchedule && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl shadow-xl border border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50 shrink-0">
                    <h3 className="font-bold text-white text-lg">Detalhes da Escala</h3>
                    <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
                    {/* Header Info */}
                    <div>
                        <h4 className="text-2xl font-bold text-white mb-2">{viewingSchedule.title}</h4>
                        <p className="text-slate-400 text-sm mb-4">{viewingSchedule.date.split('-').reverse().join('/')} às {viewingSchedule.time.substring(0,5)}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                            <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-2"><Users className="w-4 h-4 text-slate-500"/> {viewingSchedule.members.length} {viewingSchedule.max_volunteers ? `/ ${viewingSchedule.max_volunteers} Vagas` : 'Pessoas na lista'}</div>
                            {viewingSchedule.location && <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-2" ><MapPin className="w-4 h-4 text-slate-500"/> {viewingSchedule.location}</div>}
                        </div>
                    </div>

                    {/* Lista Completa de Membros */}
                    <div className="border-t border-slate-700/50 pt-6">
                        <h4 className="font-bold text-slate-300 mb-4">Lista de Escalados / Participantes</h4>
                        <div className="space-y-2">
                             {viewingSchedule.members.map(sm => (
                                 <div key={sm.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                                     <div className="flex items-center gap-3">
                                         <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white overflow-hidden">{sm.profile.full_name?.charAt(0)}</div>
                                         <div>
                                             <div className="flex items-center gap-2">
                                                <p className="text-sm text-slate-200 font-medium leading-none mb-1">{sm.profile.id === profile.id ? <span className="text-red-400 font-bold">{sm.profile.full_name} (Você)</span> : sm.profile.full_name}</p>
                                                {sm.status === 'pendente' && <span className="bg-slate-500/20 text-slate-300 text-[10px] px-2 py-0.5 rounded font-bold">Aguardando Resposta</span>}
                                                {sm.status === 'aguardando_lider' && <span className="bg-amber-500/20 text-amber-500 text-[10px] px-2 py-0.5 rounded font-bold">Pediu Vaga</span>}
                                                {sm.status === 'confirmado' && <span className="bg-emerald-500/20 text-emerald-500 text-[10px] px-2 py-0.5 rounded font-bold">Confirmado</span>}
                                             </div>
                                             <span className="text-[10px] text-slate-500 font-medium">{sm.role_name}</span>
                                         </div>
                                     </div>
                                     {canManage && (
                                         <div className="flex items-center gap-2">
                                            {(sm.status === 'pendente' || sm.status === 'aguardando_lider') && (
                                                <button onClick={() => handleUpdateStatus(sm.id, 'confirmado')} className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition" title="Aprovar/Confirmar"><CheckCircle className="w-4 h-4"/></button>
                                            )}
                                            <button onClick={() => handleRemoveMember(sm.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition" title="Remover / Recusar"><XCircle className="w-4 h-4"/></button>
                                         </div>
                                     )}
                                 </div>
                             ))}
                             {viewingSchedule.members.length === 0 && <p className="text-xs text-slate-500 italic">Ninguém está nesta lista ainda.</p>}
                        </div>
                    </div>

                    {/* Ações Finais (Cancelar ou Participar) */}
                    <div className="mt-4 pt-4 border-t border-slate-800">
                         {(() => {
                              const amIVolunteered = viewingSchedule.members.some(sm => sm.profile.id === profile.id);
                              const isFull = viewingSchedule.max_volunteers !== null && viewingSchedule.members.length >= viewingSchedule.max_volunteers;

                              if (amIVolunteered) {
                                  return <button onClick={() => handleCancelParticipation(viewingSchedule.id)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-red-500/50 text-slate-300 hover:text-red-400 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"><XCircle className="w-5 h-5"/> Cancelar / Remover meu Pedido</button>
                              } else {
                                  return <button onClick={() => handleVolunteer(viewingSchedule)} disabled={isFull} className={`w-full py-3 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2 ${isFull ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'}`}>{isFull ? 'Vagas Esgotadas' : <><CheckCircle className="w-5 h-5"/> Pedir para Participar</>}</button>
                              }
                         })()}
                        {canManage && (
                           <div className="mt-4 flex justify-center"><button onClick={() => handleDeleteSchedule(viewingSchedule.id)} className="text-xs text-red-500 hover:text-red-400 underline transition">Excluir Escala Inteira (Admin)</button></div>
                        )}
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* Modal Criar Escala ... omitting unchanged structure but keeping it working */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl shadow-xl border border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50 shrink-0"><h3 className="font-bold text-white text-lg">Criar Nova Escala / Vagas</h3><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full"><X className="w-5 h-5"/></button></div>
                <form onSubmit={handleCreateSchedule} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3 border-b border-slate-700/50 pb-2 mb-2"><h4 className="text-sm font-bold text-slate-300">1. Dados do Evento</h4></div>
                        <div className="md:col-span-3"><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Título da Escala</label><input type="text" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} required placeholder="Ex: Mutirão de Limpeza" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                        <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Data</label><input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500 [color-scheme:dark]" /></div>
                        <div className="md:col-span-1"><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Hora</label><input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500 [color-scheme:dark]" /></div>
                        <div className="md:col-span-2"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center justify-between">Localização <span className="text-slate-500">(Opcional)</span></label><input type="text" value={scheduleLocation} onChange={(e) => setScheduleLocation(e.target.value)} placeholder="Ex: Sede Principal" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                        <div className="md:col-span-1"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center justify-between">Limite <span className="text-slate-500">(Vazio = ilimitado)</span></label><input type="number" min="1" value={scheduleMaxVolunteers} onChange={(e) => setScheduleMaxVolunteers(e.target.value)} placeholder="Ilimitado" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="border-b border-slate-700/50 pb-2"><h4 className="text-sm font-bold text-slate-300">2. Convocar Membros Imediatamente</h4></div>
                        {assignedMembers.map((am, idx) => (
                           <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                               <div className="w-full sm:w-1/2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quem?</label><select value={am.profile_id} onChange={(e) => updateAssignedMember(idx, 'profile_id', e.target.value)} required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white outline-none focus:border-red-500"><option value="">Selecione...</option>{allMembers.map(m => (<option key={m.id} value={m.id}>{m.full_name}</option>))}</select></div>
                               <div className="w-full sm:w-1/2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qual a função?</label><input type="text" value={am.role_name} onChange={(e) => updateAssignedMember(idx, 'role_name', e.target.value)} required placeholder="Ex: Cantor..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-red-500" /></div>
                               <button type="button" onClick={() => removeAssignedMemberSlot(idx)} className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-slate-800 rounded-lg shrink-0"><Trash2 className="w-4 h-4"/></button>
                           </div>
                        ))}
                        <button type="button" onClick={addAssignedMemberSlot} className="flex justify-center gap-2 py-3 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400 transition text-sm font-medium"><Plus className="w-4 h-4"/> Adicionar pessoa na escala agora</button>
                    </div>
                    <div className="mt-4 flex gap-3 pt-4 border-t border-slate-800 shrink-0"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button type="submit" className="flex-1 px-4 py-3 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20">Publicar Vagas / Escala</button></div>
                </form>
             </div>
          </div>
      )}

    </Sidebar>
  );
}
