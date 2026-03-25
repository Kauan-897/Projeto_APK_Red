import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { ArrowLeft, Users, Building2, UsersRound, Plus, MapPin, X, ShieldAlert, ChevronRight, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MembersPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('membros'); // 'membros', 'ministerios', 'congregacoes'
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [members, setMembers] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isMinistryModalOpen, setIsMinistryModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  // Form States
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [editingBranch, setEditingBranch] = useState(null);
  
  const [ministryName, setMinistryName] = useState('');
  const [ministryDescription, setMinistryDescription] = useState('');
  const [ministryLeaderId, setMinistryLeaderId] = useState('');
  const [editingMinistry, setEditingMinistry] = useState(null);

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('membro');
  const [memberPassword, setMemberPassword] = useState('Mudar@123');
  const [memberGender, setMemberGender] = useState('M');

  // Roles that can manage
  const canManage = ['desenvolvedor', 'pastor', 'admin', 'supervisor'].includes(profile?.role);

  useEffect(() => {
    if (profile?.church_id) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Busca Filiais 
      const { data: bData, error: bErr } = await supabase.from('branches').select('*').eq('church_id', profile.church_id).order('name');
      if (!bErr && bData) setBranches(bData);
      
      // Busca Ministérios 
      const { data: minData, error: mErr } = await supabase.from('ministries').select('*').eq('church_id', profile.church_id).order('name');
      const { data: pmData } = await supabase.from('profile_ministries').select(`ministry_id, status, profile:profiles(id, name, avatar_url)`);
      
      if (!mErr && minData) {
         const minsWithParts = minData.map(min => ({
             ...min,
             participants: pmData?.filter(pm => pm.ministry_id === min.id) || []
         }));
         setMinistries(minsWithParts);
      } else if (mErr) console.error("Erro Ministérios: ", mErr);

      // Busca Membros
      const { data: memData } = await supabase.from('profiles').select('*').eq('church_id', profile.church_id).order('name');
      if (memData) setMembers(memData);

    } catch (err) {
      console.log("Algumas tabelas podem não ter sido criadas ainda no Supabase.", err);
    }
    setLoading(false);
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (!branchName) return toast.error('Nome da filial é obrigatório.');

    const payload = { church_id: profile.church_id, name: branchName, address: branchAddress };
    let error;
    if (editingBranch) {
       const res = await supabase.from('branches').update(payload).eq('id', editingBranch.id);
       error = res.error;
    } else {
       const res = await supabase.from('branches').insert([payload]);
       error = res.error;
    }

    if (error) toast.error('Erro ao salvar: ' + error.message);
    else {
      toast.success(editingBranch ? 'Filial atualizada!' : 'Filial criada com sucesso!');
      setIsBranchModalOpen(false);
      fetchData();
    }
  };

  const handleSaveMinistry = async (e) => {
    e.preventDefault();
    if (!ministryName) return toast.error('Nome do ministério é obrigatório.');

    const payload = { church_id: profile.church_id, name: ministryName, description: ministryDescription, leader_id: ministryLeaderId || null };
    let error;
    if (editingMinistry) {
       const res = await supabase.from('ministries').update(payload).eq('id', editingMinistry.id);
       error = res.error;
    } else {
       const res = await supabase.from('ministries').insert([payload]);
       error = res.error;
    }

    if (error) toast.error('Erro ao salvar: ' + error.message);
    else {
      toast.success(editingMinistry ? 'Ministério atualizado!' : 'Ministério criado com sucesso!');
      setIsMinistryModalOpen(false);
      fetchData();
    }
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    if (!memberName || !memberEmail || !memberPassword || !memberGender) return toast.error('Preencha os dados obrigatórios.');

    const { error } = await supabase.rpc('admin_create_user', {
       new_email: memberEmail.toLowerCase().trim(),
       new_password: memberPassword,
       new_fullname: memberName,
       new_role: memberRole,
       new_church_id: profile.church_id,
       new_gender: memberGender
    });

    if (error) toast.error(error.message);
    else {
       toast.success('Membro adicionado com sucesso!');
       setIsMemberModalOpen(false);
       setMemberName(''); setMemberEmail(''); setMemberRole('membro'); setMemberPassword('Mudar@123'); setMemberGender('M');
       fetchData();
    }
  };

  const handleDeleteBranch = async () => {
     if (!editingBranch || !window.confirm("Deseja excluir permanentemente?")) return;
     const { error } = await supabase.from('branches').delete().eq('id', editingBranch.id);
     if (error) toast.error('Erro ao excluir: ' + error.message);
     else { toast.success("Filial excluída com sucesso."); setIsBranchModalOpen(false); fetchData(); }
  };

  const handleDeleteMinistry = async () => {
     if (!editingMinistry || !window.confirm("Deseja excluir permanentemente?")) return;
     const { error } = await supabase.from('ministries').delete().eq('id', editingMinistry.id);
     if (error) toast.error('Erro ao excluir: ' + error.message);
     else { toast.success("Ministério excluído com sucesso."); setIsMinistryModalOpen(false); fetchData(); }
  };

  // Funções de Participação nos Ministérios
  const handleJoinMinistry = async (ministryId) => {
      const payload = { profile_id: profile.id, ministry_id: ministryId, status: 'pendente' };
      const { error } = await supabase.from('profile_ministries').insert([payload]);
      if (error) toast.error(error.message.includes("does not exist") ? "Tabela não encontrada. Rode o SQL!" : "Erro ao solicitar: " + error.message);
      else {
          toast.success("Solicitação enviada ao líder do ministério!");
          setIsMinistryModalOpen(false);
          fetchData();
      }
  };

  const handleLeaveMinistry = async (ministryId) => {
      if (!window.confirm("Confirmar a saída/cancelamento?")) return;
      const { error } = await supabase.from('profile_ministries').delete().match({ profile_id: profile.id, ministry_id: ministryId });
      if (error) toast.error("Erro ao sair: " + error.message);
      else {
          toast.success("Você saiu do ministério.");
          setIsMinistryModalOpen(false);
          fetchData();
      }
  };

  const handleUpdateParticipantStatus = async (profileId, ministryId, newStatus) => {
      const { error } = await supabase.from('profile_ministries').update({ status: newStatus }).match({ profile_id: profileId, ministry_id: ministryId });
      if (error) toast.error("Erro ao aprovar: " + error.message);
      else {
          toast.success("Status atualizado!");
          setIsMinistryModalOpen(false);
          fetchData();
      }
  };

  // Abertura de Modais
  const openBranchModal = (branch = null) => {
      setEditingBranch(branch);
      setBranchName(branch ? branch.name : ''); setBranchAddress(branch ? (branch.address || '') : '');
      setIsBranchModalOpen(true);
  };

  const openMinistryModal = (ministry = null) => {
      setEditingMinistry(ministry);
      setMinistryName(ministry ? ministry.name : '');
      setMinistryDescription(ministry ? (ministry.description || '') : '');
      setMinistryLeaderId(ministry ? (ministry.leader_id || '') : '');
      setIsMinistryModalOpen(true);
  };

  const getRoleBadge = (role) => {
      switch(role) {
          case 'pastor': return <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Pastor</span>;
          case 'desenvolvedor': return <span className="bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Dev</span>;
          case 'admin': return <span className="bg-purple-500/20 text-purple-500 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Admin</span>;
          case 'lider_homem': return <span className="bg-blue-500/20 text-blue-500 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Líder H.</span>;
          case 'lider_mulher': return <span className="bg-pink-500/20 text-pink-500 border border-pink-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Líder M.</span>;
          default: return <span className="bg-slate-700/50 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Membro</span>;
      }
  };

  const filteredMembers = members.filter(m => m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredMinistries = ministries.filter(m => m.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredBranches = branches.filter(b => b.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <Sidebar><div className="flex items-center justify-center text-slate-400 h-full">Carregando dados...</div></Sidebar>;

  return (
    <Sidebar>
      {/* Header com botão de voltar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Membros e Equipes</h1>
            <p className="text-sm text-slate-400">Gerencie contas, líderes e departamentos estruturais</p>
          </div>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div className="flex gap-3 w-full md:w-auto">
             {activeTab === 'congregacoes' && (
                <button onClick={() => openBranchModal()} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium rounded-lg transition"><Plus className="w-4 h-4"/> Nova Filial</button>
             )}
             {activeTab === 'ministerios' && (
                <button onClick={() => openMinistryModal()} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium rounded-lg transition"><Plus className="w-4 h-4"/> Novo Ministério</button>
             )}
             {activeTab === 'membros' && (
                <button onClick={() => setIsMemberModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-500/20 transition"><Plus className="w-4 h-4"/> Adicionar Membro</button>
             )}
          </div>
        )}
      </div>

      {/* Navegação de Tabs e Barra de Busca */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="flex bg-slate-800/50 p-1 rounded-xl w-full md:w-max border border-slate-700/50">
            <button onClick={() => { setActiveTab('membros'); setSearchTerm(''); }} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'membros' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Membros <span className="ml-2 text-[10px] bg-slate-900 px-2 py-0.5 rounded-full">{members.length}</span></button>
            <button onClick={() => { setActiveTab('ministerios'); setSearchTerm(''); }} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ministerios' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Ministérios <span className="ml-2 text-[10px] bg-slate-900 px-2 py-0.5 rounded-full">{ministries.length}</span></button>
            <button onClick={() => { setActiveTab('congregacoes'); setSearchTerm(''); }} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'congregacoes' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Congregações <span className="ml-2 text-[10px] bg-slate-900 px-2 py-0.5 rounded-full">{branches.length}</span></button>
          </div>

          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-slate-500" /></div>
            <input type="text" className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-xl leading-5 bg-slate-800/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition sm:text-sm" placeholder={`Pesquisar em ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {activeTab === 'membros' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-bold text-white mb-6">Todos os Membros</h2>
          {filteredMembers.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               {filteredMembers.map(member => (
                 <div key={member.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition cursor-pointer flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center overflow-hidden shrink-0">{member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <span className="text-lg font-bold text-slate-400">{member.name?.charAt(0).toUpperCase()}</span>}</div>
                       <div>
                          <h4 className="font-bold text-white text-sm line-clamp-1">{member.name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{member.email}</p>
                          <div className="mt-2">{getRoleBadge(member.role)}</div>
                       </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition" />
                 </div>
               ))}
             </div>
          ) : (
             <div className="bg-slate-800/30 rounded-2xl border border-slate-800/50 h-[300px] flex flex-col items-center justify-center text-slate-500">
               <Users className="w-16 h-16 mb-4 opacity-50 stroke-[1.5]" />
               <h3 className="text-lg font-medium text-slate-300">{searchTerm ? 'Nenhum resultado' : 'Nenhum membro listado'}</h3>
             </div>
          )}
        </div>
      )}

      {activeTab === 'ministerios' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-bold text-white mb-6">Departamentos & Ministérios</h2>
          {filteredMinistries.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMinistries.map(min => (
                  <div key={min.id} onClick={() => openMinistryModal(min)} className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-500 transition cursor-pointer">
                     <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-4">
                        <UsersRound className="w-5 h-5" />
                     </div>
                     <h3 className="text-lg font-bold text-white mb-2">{min.name}</h3>
                     <p className="text-sm text-slate-400 line-clamp-2 mb-4 h-10">{min.description || 'Sem descrição.'}</p>
                     
                     <div className="pt-4 border-t border-slate-700 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-300 bg-slate-900 border border-slate-700 px-2 py-1 rounded-md">{min.participants?.length || 0} Participantes</span>
                         </div>
                         <div className="text-xs text-slate-500 text-right">
                            <span className="block text-slate-400 font-medium">{min.leader_id ? members.find(m => m.id === min.leader_id)?.name || 'Desconhecido' : 'Sem Líder'}</span>
                            Líder
                         </div>
                     </div>
                  </div>
                ))}
             </div>
          ) : (
             <div className="bg-slate-800/30 rounded-2xl border border-slate-800/50 h-[300px] flex flex-col items-center justify-center text-slate-500">
               <UsersRound className="w-16 h-16 mb-4 opacity-50 stroke-[1.5]" />
               <h3 className="text-lg font-medium text-slate-300">{searchTerm ? 'Nenhum resultado' : 'Nenhum ministério'}</h3>
             </div>
          )}
        </div>
      )}

      {activeTab === 'congregacoes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <h2 className="text-xl font-bold text-white mb-6">Congregações Fisicas (Filiais)</h2>
           {filteredBranches.length > 0 ? (
             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBranches.map(branch => (
                  <div key={branch.id} onClick={() => canManage && openBranchModal(branch)} className={`bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 relative overflow-hidden group hover:border-slate-500 transition ${canManage ? 'cursor-pointer' : ''}`}>
                     <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Building2 className="w-24 h-24" /></div>
                     <div className="relative z-10">
                         <h3 className="text-xl font-bold text-white mb-1">{branch.name}</h3>
                         <div className="flex items-start gap-2 text-slate-400 text-sm mt-3 h-10">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{branch.address || 'Endereço não cadastrado'}</span>
                         </div>
                         <div className="mt-6 inline-flex items-center gap-2 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300"><Users className="w-3.5 h-3.5" /> 0 Membros alocados</div>
                     </div>
                  </div>
                ))}
             </div>
           ) : (
             <div className="bg-slate-800/30 rounded-2xl border border-slate-800/50 h-[300px] flex flex-col items-center justify-center text-slate-500"><Building2 className="w-16 h-16 mb-4 opacity-50 stroke-[1.5]" /><h3 className="text-lg font-medium text-slate-300">{searchTerm ? 'Nenhum resultado' : 'Nenhuma filial'}</h3></div>
           )}
        </div>
      )}

      {/* --- MODALS --- */}
      {/* Modal Filial */}
      {isBranchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#1e293b] w-full max-w-md rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50"><h3 className="font-bold text-white">{editingBranch ? 'Editar Filial' : 'Cadastrar Filial'}</h3><button onClick={() => setIsBranchModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full"><X className="w-5 h-5"/></button></div>
                <form onSubmit={handleSaveBranch} className="p-6 flex flex-col gap-4">
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome</label><input type="text" value={branchName} onChange={(e) => setBranchName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Endereço (Opcional)</label><textarea value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500 resize-none" /></div>
                    <div className="mt-4 flex gap-3">
                        {editingBranch && <button type="button" onClick={handleDeleteBranch} className="flex-none px-4 py-3 rounded-lg text-red-500 border border-transparent hover:border-red-500/20"><Trash2 className="w-5 h-5"/></button>}
                        <button type="button" onClick={() => setIsBranchModalOpen(false)} className="flex-1 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-3 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">Salvar</button>
                    </div>
                </form>
             </div>
          </div>
      )}

      {/* Modal Ministério unificado (View/Edit) */}
      {isMinistryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#1e293b] w-full max-w-md rounded-2xl shadow-xl border border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50 shrink-0">
                    <h3 className="font-bold text-white">{editingMinistry ? (canManage ? 'Gerenciar Ministério' : 'Detalhes do Ministério') : 'Criar Ministério'}</h3>
                    <button onClick={() => setIsMinistryModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                
                <form onSubmit={handleSaveMinistry} className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {/* Básico */}
                    {canManage || !editingMinistry ? (
                        <div className="flex flex-col gap-4">
                            <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome da Equipe</label><input type="text" value={ministryName} onChange={(e) => setMinistryName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                            <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Líder do Ministério</label><select value={ministryLeaderId} onChange={(e) => setMinistryLeaderId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"><option value="">Nenhum líder</option>{members.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}</select></div>
                            <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Descrição (Opcional)</label><textarea value={ministryDescription} onChange={(e) => setMinistryDescription(e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500 resize-none" /></div>
                        </div>
                    ) : (
                        <div className="mb-6">
                           <h4 className="text-2xl font-bold text-white mb-2">{ministryName}</h4>
                           <p className="text-slate-400 text-sm mb-4">{ministryDescription || 'Sem decrição cadastrada.'}</p>
                           <div className="inline-block px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300">Líder atual: <b className="text-white">{members.find(m => m.id === ministryLeaderId)?.name || 'Sem Líder'}</b></div>
                        </div>
                    )}

                    {/* Lista de Participantes e Solicitações */}
                    {editingMinistry && (
                        <div className="mt-8 pt-6 border-t border-slate-700/50">
                            <div className="flex justify-between items-center mb-4">
                               <h4 className="font-bold text-slate-300">Integrantes e Pedidos</h4>
                               <span className="text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded">{editingMinistry.participants.length} Pessoas</span>
                            </div>
                            
                            <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                {editingMinistry.participants.map(p => (
                                    <div key={p.profile.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white overflow-hidden">{p.profile.avatar_url ? <img src={p.profile.avatar_url} className="w-full h-full object-cover"/> : p.profile.name.charAt(0)}</div>
                                            <div>
                                                <p className="text-sm text-slate-200 font-medium leading-none mb-1">{p.profile.name}</p>
                                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${p.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>{p.status}</span>
                                            </div>
                                        </div>
                                        {canManage && p.status === 'pendente' && (
                                            <button type="button" onClick={() => handleUpdateParticipantStatus(p.profile.id, editingMinistry.id, 'ativo')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition">Aprovar</button>
                                        )}
                                        {canManage && p.status === 'ativo' && (
                                            <button type="button" onClick={() => handleUpdateParticipantStatus(p.profile.id, editingMinistry.id, 'pendente')} className="text-slate-500 hover:text-red-500 text-xs transition" title="Mudar para Pendente / Remover"><X className="w-4 h-4"/></button>
                                        )}
                                    </div>
                                ))}
                                {editingMinistry.participants.length === 0 && <p className="text-xs text-slate-500 italic">Nenhum integrante aparecendo.</p>}
                            </div>

                            {/* Ações do Usuário Comum com o Ministério */}
                            <div className="mt-6">
                                {(() => {
                                    const myParticipation = editingMinistry?.participants?.find(p => p.profile.id === profile.id);
                                    if (!myParticipation) {
                                        return <button type="button" onClick={() => handleJoinMinistry(editingMinistry.id)} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-500/20 transition">Solicitar Participação</button>;
                                    }
                                    if (myParticipation.status === 'pendente') {
                                        return (
                                            <div className="flex flex-col gap-2">
                                               <div className="w-full py-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-sm font-bold text-center">Solicitação Aguardando Líder</div>
                                               <button type="button" onClick={() => handleLeaveMinistry(editingMinistry.id)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition cursor-pointer">Cancelar Solicitação</button>
                                            </div>
                                        );
                                    }
                                    if (myParticipation.status === 'ativo') {
                                        return <button type="button" onClick={() => handleLeaveMinistry(editingMinistry.id)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-sm font-bold transition">Sair deste Ministério</button>;
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Footer Actions (Save / Delete se for Admin) */}
                    {(canManage || !editingMinistry) && (
                        <div className="mt-6 flex gap-3 pt-4 border-t border-slate-800 shrink-0">
                            {editingMinistry && <button type="button" onClick={handleDeleteMinistry} className="flex-none px-4 py-3 rounded-lg text-red-500 border border-transparent hover:border-red-500/20"><Trash2 className="w-5 h-5"/></button>}
                            <button type="button" onClick={() => setIsMinistryModalOpen(false)} className="flex-1 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition">Fechar</button>
                            <button type="submit" className="flex-1 px-4 py-3 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">Salvar Alterações</button>
                        </div>
                    )}
                </form>
             </div>
          </div>
      )}

      {/* Modal Novo Membro ... */}
      {isMemberModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-[#1e293b] w-full max-w-md rounded-2xl shadow-xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50"><h3 className="font-bold text-white">Adicionar Novo Membro</h3><button onClick={() => setIsMemberModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full"><X className="w-5 h-5"/></button></div>
                <form onSubmit={handleCreateMember} className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome Completo</label><input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">E-mail</label><input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Gênero</label><select value={memberGender} onChange={(e) => setMemberGender(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500"><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Senha Provisória</label><input type="text" value={memberPassword} onChange={(e) => setMemberPassword(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500" /></div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Cargo / Nível de Acesso</label>
                        <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-red-500 cursor-pointer">
                           <option value="membro">Membro Comum</option>
                           {profile?.role === 'desenvolvedor' && (
                              <><option value="lider_homem">Líder (Homem)</option><option value="lider_mulher">Líder (Mulher)</option><option value="pastor">Pastor</option><option value="supervisor">Supervisor</option><option value="desenvolvedor">Desenvolvedor</option></>
                           )}
                        </select>
                    </div>
                    <div className="mt-4 flex gap-3"><button type="button" onClick={() => setIsMemberModalOpen(false)} className="flex-1 px-4 py-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Cancelar</button><button type="submit" className="flex-1 px-4 py-3 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500">Criar Acesso</button></div>
                </form>
             </div>
          </div>
      )}

    </Sidebar>
  );
}
