
import React, { useState, useEffect } from 'react';
import { validatePassword } from '../utils/helpers';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'LOGIN' | 'FORGOT' | 'FIRST_ACCESS'>('LOGIN');

  const [tempUser, setTempUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  // Clean fields and check session for first access persistence
  useEffect(() => {
    setEmail('');
    setPassword('');
    setForgotEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');

    const checkFirstAccessSession = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        const isFirst = profile?.is_first_access === true ||
          authUser.user_metadata?.is_first_access === true ||
          authUser.user_metadata?.isFirstAccess === true;

        if (isFirst) {
          const user: User = {
            id: authUser.id,
            nome: profile?.nome || authUser.user_metadata?.nome || 'Usuário',
            email: authUser.email || '',
            celular: profile?.celular || '',
            funcao: profile?.funcao || '',
            role: (profile?.role as UserRole) || 'USER',
            isFirstAccess: true,
            status: 'ACTIVE'
          };
          setTempUser(user);
          setView('FIRST_ACCESS');
        }
      }
    };

    checkFirstAccessSession();
  }, [view]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Check if user is blocked
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (profile && profile.is_blocked) {
        throw new Error('Esta conta está bloqueada. Contate o suporte.');
      }

      // 2. Auth login
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) throw authError;

      // 3. Check for enforced change
      const isFirst = profile?.is_first_access ||
        data.user?.user_metadata?.is_first_access ||
        data.user?.user_metadata?.isFirstAccess;

      if (isFirst) {
        const user: User = {
          id: data.user.id,
          nome: profile?.nome || data.user.user_metadata?.nome || 'Usuário',
          email: data.user.email || '',
          celular: profile?.celular || '',
          funcao: profile?.funcao || '',
          role: (profile?.role as UserRole) || 'USER',
          isFirstAccess: true,
          status: 'ACTIVE'
        };
        setTempUser(user);
        setView('FIRST_ACCESS');
        // Do NOT proceed to App until password is changed
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('reset-password', {
        body: { email: forgotEmail, action: 'FORGOT_PASSWORD' }
      });
      if (fnError) throw fnError;
      alert('Se o e-mail estiver cadastrado, uma senha temporária foi enviada.');
      setView('LOGIN');
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePassword(newPassword)) {
      setError('A senha deve ter pelo menos 8 dígitos, uma letra maiúscula, um número e um caractere especial.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update Auth - Clear BOTH naming conventions
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          is_first_access: false,
          isFirstAccess: false
        }
      });
      if (updateError) throw updateError;

      // 2. Update Profile - Use only existing columns (is_first_access)
      if (tempUser?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_first_access: false
          })
          .eq('id', tempUser.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          throw new Error('Senha alterada no Auth, mas houve um erro ao atualizar seu perfil. Por favor, tente novamente ou contate o suporte.');
        }
      }

      alert('Senha atualizada com sucesso!');
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'FIRST_ACCESS') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark p-6">
        <div className="w-full max-w-md bg-surface-dark border border-surface-highlight rounded-3xl p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Definir Nova Senha</h2>
            <p className="text-text-secondary text-sm mt-2 font-medium">Olá, {tempUser?.nome}. Para continuar, crie uma senha segura de acesso.</p>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Nova Senha</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  autoFocus
                  className="w-full h-12 bg-background-dark border border-surface-highlight rounded-xl pl-4 pr-12 text-white focus:ring-2 focus:ring-primary font-bold"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                  <span className="material-symbols-outlined">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Confirmar Senha</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  className="w-full h-12 bg-background-dark border border-surface-highlight rounded-xl pl-4 pr-12 text-white focus:ring-2 focus:ring-primary font-bold"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                  <span className="material-symbols-outlined">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-danger font-bold text-center">{error}</p>}
            <button disabled={loading} className="w-full h-14 bg-primary text-background-dark font-black rounded-2xl shadow-lg shadow-primary/20">{loading ? 'PROCESSANDO...' : 'SALVAR E ACESSAR'}</button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'FORGOT') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark p-6">
        <div className="w-full max-w-md bg-surface-dark border border-surface-highlight rounded-3xl p-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Recuperar Senha</h2>
            <p className="text-text-secondary text-sm mt-2 font-medium">Insira seu e-mail para receber as instruções.</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest">E-mail Cadastrado</label>
              <input type="email" required autoComplete="off" className="w-full h-14 bg-background-dark border border-surface-highlight rounded-2xl px-5 text-white focus:ring-2 focus:ring-primary font-bold" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
            </div>
            {error && <p className="text-xs text-danger font-bold text-center">{error}</p>}
            <button disabled={loading} className="w-full h-14 bg-primary text-background-dark font-black rounded-2xl shadow-lg shadow-primary/20">{loading ? 'ENVIANDO...' : 'ENVIAR RECUPERAÇÃO'}</button>
            <button type="button" onClick={() => setView('LOGIN')} className="w-full text-center text-text-secondary text-[10px] font-black uppercase tracking-widest">Voltar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-dark p-6">
      <div className="w-full max-w-md bg-surface-dark border-2 border-primary/50 rounded-3xl p-10 shadow-2xl animate-in fade-in duration-500">
        <div className="flex justify-center mb-10"><img src="/logo.png" alt="Logo" className="size-20 rounded-2xl" /></div>
        <div className="text-center mb-10"><h1 className="text-2xl font-black text-white tracking-tight">Gestão Financeira</h1></div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest">E-mail</label>
            <input type="email" required autoComplete="off" className="w-full h-14 bg-background-dark border border-surface-highlight rounded-2xl px-5 text-white focus:ring-2 focus:ring-primary font-bold" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Senha</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required autoComplete="new-password" className="w-full h-14 bg-background-dark border border-surface-highlight rounded-2xl pl-5 pr-14 text-white focus:ring-2 focus:ring-primary font-bold" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
                <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={() => setView('FORGOT')} className="text-[10px] font-black text-text-secondary hover:text-primary uppercase tracking-widest">Esqueceu sua senha?</button></div>
          {error && <p className="text-xs text-danger font-bold text-center">{error}</p>}
          <button disabled={loading} className="w-full h-14 bg-primary text-background-dark font-black rounded-2xl shadow-lg shadow-primary/20">{loading ? 'ACESSANDO...' : 'ENTRAR NO SISTEMA'}</button>
        </form>
        <div className="mt-8 pt-6 border-t border-surface-highlight/50 text-center relative">
          <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">FinTek &copy; 2023 - Sintek Tecnologia</p>
          <div className="mt-4"><p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">v1.5.0 - VERIFIED</p></div>
        </div>
      </div>
    </div>
  );
};

export default Login;
