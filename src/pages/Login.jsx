import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [churchId, setChurchId] = useState('');
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Buscar igrejas ativas
    const fetchChurches = async () => {
      const { data, error } = await supabase.from('churches').select('id, name').eq('is_active', true);
      if (data) setChurches(data);
    };
    fetchChurches();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Credenciais inválidas. Verifique seu e-mail e senha.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Login efetuado com sucesso!');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error('As senhas não coincidem!');
    }
    if (!churchId && churches.length > 0) {
      return toast.error('Por favor, selecione uma igreja.');
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          church_id: churchId || null,
          role: 'membro'
        }
      }
    });

    if (error) {
      if (error.message.includes('User already registered') || error.message.includes('already been registered')) {
        toast.error('Este e-mail já está registrado em nosso sistema.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Cadastro realizado! Verifique seu e-mail (se necessário) ou faça login.');
      setIsLogin(true);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      return toast.error('Digite seu e-mail no campo acima para redefinir a senha.');
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      toast.error('Erro ao enviar e-mail de recuperação: ' + error.message);
    } else {
      toast.success('E-mail de recuperação de senha enviado!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-950 via-red-900 to-black text-slate-100 p-4">
      <div className="bg-slate-900/80 backdrop-blur-xl p-10 rounded-2xl shadow-2xl w-full max-w-md text-center border border-red-900/40">
        
        <div className="bg-gradient-to-br from-red-600 to-red-400 w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-[0_4px_20px_rgba(239,68,68,0.5)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-white" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-4H10v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
        </div>

        <h1 className="text-3xl font-bold mb-1 text-white tracking-tight">Igreja Digital</h1>
        <p className="text-red-200/60 font-medium mb-8 text-sm">Sistema de Gestão</p>

        <div className="flex bg-slate-950/50 rounded-xl mb-8 p-1 shadow-inner border border-white/5">
          <button 
            type="button"
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${isLogin ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setIsLogin(true)}
          >
            Entrar
          </button>
          <button 
            type="button"
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${!isLogin ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setIsLogin(false)}
          >
            Cadastrar
          </button>
        </div>

        {isLogin ? (
          <form className="flex flex-col text-left" onSubmit={handleLogin}>
            <label className="mb-2 font-semibold text-sm text-slate-300">Email</label>
            <input 
              type="email" 
              className="px-4 py-3 mb-5 rounded-lg border border-slate-700/50 bg-slate-800/80 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder-slate-500" 
              placeholder="seu@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />

            <label className="mb-2 font-semibold text-sm text-slate-300">Senha</label>
            <input 
              type="password" 
              className="px-4 py-3 mb-6 rounded-lg border border-slate-700/50 bg-slate-800/80 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder-slate-500" 
              placeholder="****" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />

            <button disabled={loading} type="submit" className="py-3 mt-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-lg shadow-[0_6px_20px_rgba(220,38,38,0.4)] hover:from-red-500 hover:to-red-400 transition-all disabled:opacity-50 active:scale-[0.98]">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form className="flex flex-col text-left" onSubmit={handleRegister}>
            <label className="mb-1 font-semibold text-sm text-slate-300">Nome Completo</label>
            <input 
              type="text" 
              className="px-4 py-3 mb-4 rounded-lg border border-slate-700/50 bg-slate-800/80 text-white focus:border-red-500 outline-none transition-all placeholder-slate-500" 
              placeholder="Seu Nome" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required 
            />

            <label className="mb-1 font-semibold text-sm text-slate-300">Igreja</label>
            <select 
              className="px-4 py-3 mb-4 rounded-lg border border-slate-700/50 bg-slate-800/80 text-white focus:border-red-500 outline-none transition-all"
              value={churchId}
              onChange={(e) => setChurchId(e.target.value)}
              required={churches.length > 0}
            >
              <option value="">Selecione sua igreja...</option>
              {churches.map(church => (
                <option key={church.id} value={church.id}>{church.name}</option>
              ))}
            </select>

            <label className="mb-1 font-semibold text-sm text-slate-300">Email</label>
            <input 
              type="email" 
              className="px-4 py-3 mb-4 rounded-lg border border-slate-700/50 bg-slate-800/80 text-white focus:border-red-500 outline-none transition-all placeholder-slate-500" 
              placeholder="seu@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />

            <label className="mb-1 font-semibold text-sm text-slate-300">Senha</label>
            <input 
              type="password" 
              className="px-4 py-3 mb-4 rounded-lg border border-slate-700/50 bg-slate-800/80 text-white focus:border-red-500 outline-none transition-all placeholder-slate-500" 
              placeholder="****" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />

            <label className="mb-1 font-semibold text-sm text-slate-300">Confirmar Senha</label>
            <input 
              type="password" 
              className="px-4 py-3 mb-6 rounded-lg border border-slate-700/50 bg-slate-800/80 text-white focus:border-red-500 outline-none transition-all placeholder-slate-500" 
              placeholder="****" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required 
            />

            <button disabled={loading} type="submit" className="py-3 mt-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-lg shadow-[0_6px_20px_rgba(220,38,38,0.4)] hover:from-red-500 hover:to-red-400 transition-all disabled:opacity-50 active:scale-[0.98]">
               {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>
        )}

        {isLogin && (
          <div 
            onClick={handleForgotPassword}
            className="mt-6 text-sm text-red-300/60 cursor-pointer hover:text-white transition-colors underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
