
// Deploy v1.5.0 - 2026-02-25T20:56
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Schedule from './screens/Schedule';
import Payable from './screens/Payable';
import Receivable from './screens/Receivable';
import Investments from './screens/Investimentos';
import CompanyReg from './screens/Cadastros/CompanyReg';
import PeopleReg from './screens/Cadastros/PeopleReg';
import BankReg from './screens/Cadastros/BankReg';
import SupplierReg from './screens/Cadastros/SupplierReg';
import CustomerReg from './screens/Cadastros/CustomerReg';
import UserReg from './screens/Cadastros/UserReg';
import AuditLog from './screens/Cadastros/AuditLog';
import KanbanBoard from './screens/CRM/KanbanBoard';
import { User, UserRole } from './types';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async (userId: string, email: string, metadata: any) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const user: User = {
        id: userId,
        nome: profile?.nome || metadata?.nome || email.split('@')[0] || 'Usuário',
        email: email,
        celular: profile?.celular || metadata?.celular || '',
        funcao: profile?.funcao || metadata?.funcao || '',
        role: (profile?.role as UserRole) || (metadata?.role as UserRole) || 'USER',
        isFirstAccess: profile?.is_first_access || metadata?.is_first_access || metadata?.isFirstAccess || false,
        status: profile?.is_blocked ? 'BLOCKED' : 'ACTIVE'
      };

      // If user is from sintektecnologia and it's sergio, ensure MASTER_ADMIN
      if (email === 'sergio@sintektecnologia.com.br' && user.role !== 'MASTER_ADMIN') {
        user.role = 'MASTER_ADMIN';
      }

      setCurrentUser(user);
      setLoading(false);
    };

    // Check active user directly from server to avoid stale session cache
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        fetchUserData(user.id, user.email!, user.user_metadata);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user.id, session.user.email!, session.user.user_metadata);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    setCurrentUser(null);
    window.location.href = '/';
    window.location.reload();
  };

  if (loading) return null;

  if (!currentUser || currentUser.isFirstAccess) {
    return <Login />;
  }

  return (
    <Router>
      <Layout user={currentUser} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard user={currentUser} />} />
          <Route path="/agendamentos" element={<Schedule user={currentUser} />} />
          <Route path="/pagar" element={<Payable user={currentUser} />} />
          <Route path="/receber" element={<Receivable user={currentUser} />} />
          <Route path="/investimentos" element={<Investments user={currentUser} />} />
          <Route path="/cadastros/empresa" element={<CompanyReg user={currentUser} />} />
          <Route path="/cadastros/pessoa" element={<PeopleReg user={currentUser} />} />
          <Route path="/cadastros/banco" element={<BankReg user={currentUser} />} />
          <Route path="/cadastros/fornecedor" element={<SupplierReg user={currentUser} />} />
          <Route path="/cadastros/cliente" element={<CustomerReg user={currentUser} />} />

          {(currentUser.role === 'MASTER_ADMIN' || currentUser.role === 'ADMIN') && (
            <Route path="/cadastros/usuarios" element={<UserReg user={currentUser} />} />
          )}
          {currentUser.role === 'MASTER_ADMIN' && (
            <Route path="/cadastros/audit" element={<AuditLog user={currentUser} />} />
          )}

          <Route path="/crm" element={<KanbanBoard />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
