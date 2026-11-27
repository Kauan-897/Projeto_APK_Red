import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // Situação da assinatura da igreja (teste, pago, somente leitura...)
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao ler o perfil:', error);
      // Sessão de um usuário que não existe mais: encerra para voltar ao login.
      if (error.code === 'PGRST116') {
        await supabase.auth.signOut();
        return;
      }
    }
    setProfile(data ?? null);

    if (data?.church_id) {
      const { data: accessData } = await supabase.rpc('my_church_access');
      setAccess(accessData ?? null);
    } else {
      setAccess(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // setTimeout evita chamar o Supabase dentro do callback de auth (deadlock conhecido)
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
        setAccess(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    profile,
    access,
    loading,
    logout,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook exportado junto do Provider
export const useAuth = () => {
  return useContext(AuthContext);
};
