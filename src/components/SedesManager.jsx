import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function SedesManager() {
  const [churches, setChurches] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Forms e Estados
  const [newSedeName, setNewSedeName] = useState('');
  const [editingSede, setEditingSede] = useState(null);
  
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState('membro');
  const [newUserChurch, setNewUserChurch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    const { data: cData } = await supabase.from('churches').select('*').order('created_at', { ascending: false });
    if (cData) setChurches(cData);

    const { data: uData } = await supabase.from('profiles').select('*, churches(name)').order('created_at', { ascending: false });
    if (uData) setUsers(uData);
  };

  const handleCreateSede = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('churches').insert([{ name: newSedeName }]);
    if (error) {
      toast.error('Erro ao criar sede: ' + error.message);
    } else {
      toast.success('Sede criada com sucesso!');
      setNewSedeName('');
      fetchDados();
    }
    setLoading(false);
  };

  const handleUpdateSede = async (id, newName) => {
    setEditingSede(null);
    if (!newName.trim()) return;
    const { error } = await supabase.from('churches').update({ name: newName }).eq('id', id);
    if (error) toast.error('Erro ao renomear: ' + error.message);
    else { toast.success('Nome alterado!'); fetchDados(); }
  };

  const handleToggleSede = async (id, isActive) => {
    const { error } = await supabase.from('churches').update({ is_active: isActive }).eq('id', id);
    if (error) toast.error('Erro ao alterar status: ' + error.message);
    else fetchDados();
  };

  const handleDeleteSede = async (id) => {
    if (!window.confirm('Tem certeza? Isso apagará a sede. Usuários vinculados a ela podem perder acesso!')) return;
    const { error } = await supabase.from('churches').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir: ' + error.message);
    else { toast.success('Sede excluída!'); fetchDados(); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserChurch) return toast.error('Selecione uma sede/igreja!');
    
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_create_user', {
        new_email: newUserEmail,
        new_password: 'Mudar123@',
        new_fullname: newUserFullName,
        new_role: newUserRole,
        new_church_id: newUserChurch
    });

    if (error) {
      toast.error('Erro ao criar usuário: ' + error.message);
    } else {
      toast.success('Usuário criado com sucesso com a senha Mudar123@');
      setNewUserEmail('');
      setNewUserFullName('');
      fetchDados();
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-8">
      
      {/* SEÇÃO DE SEDES */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-white">Gerenciar Sedes (Igrejas)</h3>
        <form onSubmit={handleCreateSede} className="flex gap-4">
          <input 
            type="text" 
            placeholder="Nome da Nova Sede" 
            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            value={newSedeName}
            onChange={(e) => setNewSedeName(e.target.value)}
            required
          />
          <button disabled={loading} type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 font-bold transition">Criar Sede</button>
        </form>

        <ul className="mt-6 flex flex-col gap-3">
            {churches.map(c => (
              <li key={c.id} className={`flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 rounded-lg border transition-all ${c.is_active ? 'bg-slate-700/40 border-slate-600' : 'bg-slate-900/50 border-red-900/50 opacity-75'}`}>
                <div className="flex-1 mb-3 sm:mb-0">
                  {editingSede === c.id ? (
                    <input 
                      type="text" 
                      defaultValue={c.name} 
                      onBlur={(e) => handleUpdateSede(c.id, e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') handleUpdateSede(c.id, e.target.value); if(e.key === 'Escape') setEditingSede(null); }}
                      autoFocus
                      className="px-3 py-1 bg-slate-900 border border-slate-500 rounded text-white text-sm w-full max-w-sm outline-none focus:border-red-500"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                       <span className="text-white font-medium text-lg">{c.name}</span>
                       {!c.is_active && <span className="text-[10px] uppercase font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded border border-red-900/50">Pausada</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditingSede(c.id)} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition">Editar</button>
                  <button onClick={() => handleToggleSede(c.id, !c.is_active)} className={`text-sm font-medium transition ${c.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}>
                    {c.is_active ? 'Pausar' : 'Ativar'}
                  </button>
                  <button onClick={() => handleDeleteSede(c.id)} className="text-sm font-medium text-red-500 hover:text-red-400 transition">Excluir</button>
                </div>
              </li>
            ))}
            {churches.length === 0 && <p className="text-slate-500 text-sm">Nenhuma sede cadastrada.</p>}
        </ul>
      </div>

      {/* SEÇÃO DE USUÁRIOS */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-white">Cadastrar Novo Usuário (Senha Padrão: Mudar123@)</h3>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <input 
            type="text" 
            placeholder="Nome Completo" 
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            value={newUserFullName}
            onChange={(e) => setNewUserFullName(e.target.value)}
            required
          />
          <input 
            type="email" 
            placeholder="E-mail" 
            className="col-span-1 lg:col-span-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            required
          />
          <select 
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            value={newUserChurch}
            onChange={(e) => setNewUserChurch(e.target.value)}
            required
          >
            <option value="">Igreja/Sede...</option>
            {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select 
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value)}
          >
            <option value="membro">Membro</option>
            <option value="funcionario">Funcionário</option>
            <option value="pastor">Pastor</option>
            <option value="lider_homem">Líder (Homem)</option>
            <option value="lider_mulher">Líder (Mulher)</option>
            <option value="supervisor">Supervisor</option>
          </select>
          <button disabled={loading} type="submit" className="col-span-1 md:col-span-2 lg:col-span-5 px-6 py-3 mt-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 font-bold transition">Adicionar Usuário ao Sistema</button>
        </form>
      </div>

      {/* LISTA DE USUARIOS */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-white">Usuários do Sistema</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3 rounded-tr-lg">Sede</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-white font-medium">{u.full_name || '---'}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3 uppercase text-xs font-bold text-red-400">{u.role}</td>
                  <td className="px-4 py-3">{u.churches?.name || '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
