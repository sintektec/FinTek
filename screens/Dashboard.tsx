
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Unlock, ArrowRight, Sparkles, Brain } from 'lucide-react';
import { generateFinancialInsight } from '../lib/gemini';

interface KPIRecord {
  id: string;
  description: string;
  entity: string;
  value: string;
  date: string;
  status?: string;
}

interface KPIModalData {
  title: string;
  icon: string;
  records: KPIRecord[];
  type: 'pagar' | 'pago' | 'investido' | 'recebido';
}

const DashboardCard: React.FC<{
  title: string;
  amount: string;
  icon: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  color?: string;
  onClick?: () => void;
}> = ({ title, amount, icon, trend, trendType, color = 'primary', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-surface-highlight hover:border-primary/50 transition-all duration-300 relative group overflow-hidden shadow-sm hover:shadow-xl ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
      <span className={`material-symbols-outlined text-6xl text-${color}`}>{icon}</span>
    </div>
    <div className="flex flex-col gap-3 relative z-10">
      <div className="flex items-center gap-2 text-slate-500 dark:text-text-secondary">
        <span className="text-xs font-black uppercase tracking-wider">{title}</span>
      </div>
      <div>
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{amount}</h3>
        {trend && (
          <p className={`text-sm mt-1 flex items-center gap-1 font-bold ${trendType === 'positive' ? 'text-primary' : trendType === 'negative' ? 'text-danger' : 'text-slate-500 dark:text-text-secondary'
            }`}>
            <span className="material-symbols-outlined text-sm">
              {trendType === 'positive' ? 'trending_up' : trendType === 'negative' ? 'trending_down' : 'info'}
            </span>
            {trend}
          </p>
        )}
      </div>
    </div>
    <div className="h-1.5 w-full bg-slate-100 dark:bg-surface-highlight mt-6 rounded-full overflow-hidden">
      <div className={`h-full bg-${color === 'danger' ? 'danger' : 'primary'} w-[45%]`}></div>
    </div>
    {onClick && (
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="material-symbols-outlined text-primary text-xl">open_in_new</span>
      </div>
    )}
  </div>
);

const KPIModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  data: KPIModalData | null;
}> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'VENCENDO': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20';
      case 'PAGO': return 'bg-primary/10 text-primary border-primary/20';
      case 'RECEBIDO': return 'bg-primary/10 text-primary border-primary/20';
      case 'ATRASADO': return 'bg-danger/10 text-danger border-danger/20';
      case 'PENDENTE': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20';
      case 'APLICADO': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getHeaderColor = () => {
    switch (data.type) {
      case 'pagar': return 'from-danger/20 to-transparent';
      case 'pago': return 'from-primary/20 to-transparent';
      case 'investido': return 'from-blue-500/20 to-transparent';
      case 'recebido': return 'from-primary/20 to-transparent';
      default: return 'from-primary/20 to-transparent';
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`p-6 border-b border-slate-200 dark:border-surface-highlight bg-gradient-to-r ${getHeaderColor()}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 dark:bg-white/5 rounded-xl">
                  <span className="material-symbols-outlined text-2xl text-slate-900 dark:text-white">{data.icon}</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">{data.title}</h2>
                  <p className="text-sm text-slate-500 dark:text-text-secondary font-medium">{data.records.length} registro(s) encontrado(s)</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 dark:hover:bg-surface-highlight rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500 dark:text-text-secondary">close</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-surface-highlight/30 sticky top-0">
                <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-text-secondary border-b border-slate-200 dark:border-surface-highlight">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Entidade</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight">
                {data.records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-surface-highlight/10 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusColor(record.status)}`}>
                        {record.status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">{record.description}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-text-secondary text-sm font-medium">{record.entity}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-text-secondary text-sm font-medium">{record.date}</td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white text-sm">{record.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-highlight/20 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-primary text-background-dark font-black rounded-xl text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Data fetching and processing logic moved inside component

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<KPIModalData | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Real data state
  const [payables, setPayables] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    if (user.role === 'MASTER_ADMIN') {
      fetchSecurityAlerts();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const firstDayMonth = new Date();
    firstDayMonth.setDate(1);
    const firstDayMonthStr = firstDayMonth.toISOString().split('T')[0];

    const [payRes, recRes, invRes, bankRes, peopleRes, compRes] = await Promise.all([
      supabase.from('payables').select('*, supplier:suppliers(name, trade_name), company:companies(name)').order('due_date'),
      supabase.from('receivables').select('*, customer:customers(name, trade_name), company:companies(name)').order('due_date'),
      supabase.from('investments').select('*, bank:banks(*, company:companies(name)), company:companies(name)').order('created_at'),
      supabase.from('banks').select('*, company:companies(name)').order('name'),
      supabase.from('people').select('name, nickname, cpf'),
      supabase.from('companies').select('id, name, razao_social, cnpj')
    ]);

    if (payRes.data) setPayables(payRes.data);
    if (recRes.data) setReceivables(recRes.data);
    if (invRes.data) setInvestments(invRes.data);
    if (bankRes.data) setBanks(bankRes.data);
    if (peopleRes.data) setPeople(peopleRes.data);
    if (compRes.data) setCompanies(compRes.data);
    setLoading(false);
    generateAIAnalysis(payRes.data || [], recRes.data || [], invRes.data || []);
  };

  const generateAIAnalysis = async (pays: any[], recs: any[], invs: any[]) => {
    if (aiInsight || aiLoading) return;
    setAiLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const totalPay = pays.filter(p => p.status !== 'PAID').reduce((acc, p) => acc + p.amount, 0);
    const totalRec = recs.filter(r => r.status !== 'RECEIVED').reduce((acc, r) => acc + r.amount, 0);
    const totalInv = invs.reduce((acc, i) => acc + i.current_value, 0);

    const dataReport = `
      Relatório de Hoje (${today}):
      - Contas a Pagar Pendentes: ${formatBRL(totalPay)}
      - Recebimentos Pendentes: ${formatBRL(totalRec)}
      - Total Investido: ${formatBRL(totalInv)}
      - Saldo Previsto: ${formatBRL(totalRec - totalPay)}
    `;

    const insight = await generateFinancialInsight(dataReport);
    setAiInsight(insight);
    setAiLoading(false);
  };

  const fetchSecurityAlerts = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email, failed_attempts')
      .eq('is_blocked', true);

    setSecurityAlerts(data || []);
  };

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleKPIClick = (type: 'pagar' | 'pago' | 'investido' | 'recebido') => {
    const today = new Date().toISOString().split('T')[0];
    const month = new Date().getMonth();
    const year = new Date().getFullYear();

    let data: KPIModalData | null = null;

    if (type === 'pagar') {
      const records = payables
        .filter(p => p.due_date === today && p.status !== 'PAID')
        .map(p => ({
          id: p.id,
          description: p.description,
          entity: p.supplier?.trade_name || p.supplier?.name || 'N/A',
          value: formatBRL(p.amount),
          date: new Date(p.due_date).toLocaleDateString('pt-BR'),
          status: new Date(p.due_date) < new Date(today) ? 'ATRASADO' : 'PENDENTE'
        }));
      data = { title: 'Contas a Pagar Hoje', icon: 'payments', type: 'pagar', records };
    } else if (type === 'pago') {
      const records = payables
        .filter(p => p.status === 'PAID' && new Date(p.due_date).getMonth() === month && new Date(p.due_date).getFullYear() === year)
        .map(p => ({
          id: p.id,
          description: p.description,
          entity: p.supplier?.trade_name || p.supplier?.name || 'N/A',
          value: formatBRL(p.amount),
          date: new Date(p.due_date).toLocaleDateString('pt-BR'),
          status: 'PAGO'
        }));
      data = { title: 'Contas Pagas no Mês', icon: 'check_circle', type: 'pago', records };
    } else if (type === 'investido') {
      const records = investments
        .filter(i => i.created_at.split('T')[0] === today)
        .map(i => ({
          id: i.id,
          description: i.description,
          entity: i.bank?.name || 'N/A',
          value: formatBRL(i.amount),
          date: new Date(i.created_at).toLocaleDateString('pt-BR'),
          status: 'APLICADO'
        }));
      data = { title: 'Investimentos de Hoje', icon: 'savings', type: 'investido', records };
    } else if (type === 'recebido') {
      const records = receivables
        .filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === month && new Date(r.due_date).getFullYear() === year)
        .map(r => ({
          id: r.id,
          description: r.description,
          entity: r.customer?.trade_name || r.customer?.name || 'N/A',
          value: formatBRL(r.amount),
          date: new Date(r.due_date).toLocaleDateString('pt-BR'),
          status: 'RECEBIDO'
        }));
      data = { title: 'Recebimentos do Mês', icon: 'account_balance', type: 'recebido', records };
    }

    setSelectedKPI(data);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedKPI(null);
  };

  const handleUnblock = async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: false, failed_attempts: 0 })
      .eq('id', id);

    if (!error) {
      fetchSecurityAlerts();
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className="text-slate-500 dark:text-text-secondary text-sm font-bold uppercase tracking-wide mb-1">Olá, {user.nome.split(' ')[0]}!</p>
          <h1 className="text-slate-900 dark:text-white text-4xl font-black tracking-tight capitalize">
            {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </h1>
        </div>
        <div className="flex gap-3">
          {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
            <button className="px-6 py-2.5 bg-primary text-background-dark font-black rounded-xl text-sm hover:bg-primary-hover transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined">add</span> Novo Lançamento
            </button>
          )}
          <button className="px-6 py-2.5 bg-slate-200 dark:bg-surface-highlight text-slate-900 dark:text-white font-black rounded-xl text-sm hover:opacity-80 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined">download</span> Exportar
          </button>
        </div>
      </div>

      {user.role === 'MASTER_ADMIN' && securityAlerts.length > 0 && (
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-6 animate-in slide-in-from-left duration-500">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-danger/20 rounded-lg text-danger">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Alertas de Segurança</h3>
              <p className="text-sm text-slate-600 dark:text-text-secondary">{securityAlerts.length} usuário(s) bloqueado(s) por excesso de tentativas.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {securityAlerts.map(alert => (
              <div key={alert.id} className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-danger/10 flex items-center justify-between shadow-sm">
                <div>
                  <p className="font-black text-slate-900 dark:text-white text-sm">{alert.nome}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{alert.email}</p>
                </div>
                <button
                  onClick={() => handleUnblock(alert.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-danger text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                >
                  <Unlock className="w-3 h-3" /> Desbloquear
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-primary/10 via-background-dark to-primary/5 border border-primary/20 rounded-3xl p-8 relative overflow-hidden group shadow-2xl shadow-primary/5">
        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <Brain className="w-32 h-32 text-primary" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="size-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
            <Sparkles className={`w-8 h-8 ${aiLoading ? 'animate-pulse' : ''}`} />
          </div>
          <div className="flex-1 space-y-2 text-center md:text-left">
            <h3 className="text-primary font-black text-sm uppercase tracking-[0.2em]">FinTek AI Insight</h3>
            {aiLoading ? (
              <div className="flex items-center gap-3">
                <div className="h-4 w-48 bg-slate-200 dark:bg-surface-highlight rounded-full animate-pulse"></div>
              </div>
            ) : (
              <p className="text-slate-900 dark:text-white text-lg font-bold leading-relaxed">
                {aiInsight || 'Analisando seus dados financeiros para gerar recomendações personalizadas...'}
              </p>
            )}
          </div>
          {!aiLoading && aiInsight && (
            <button
              onClick={() => { setAiInsight(''); generateAIAnalysis(payables, receivables, investments); }}
              className="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Recalcular
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="A Pagar Hoje"
          amount={formatBRL(payables.filter(p => p.due_date === new Date().toISOString().split('T')[0] && p.status !== 'PAID').reduce((acc, p) => acc + p.amount, 0))}
          icon="payments"
          trend={`${payables.filter(p => p.due_date === new Date().toISOString().split('T')[0] && p.status !== 'PAID').length} títulos para hoje`}
          trendType="negative"
          color="danger"
          onClick={() => handleKPIClick('pagar')}
        />
        <DashboardCard
          title="Pago no Mês"
          amount={formatBRL(payables.filter(p => p.status === 'PAID' && new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0))}
          icon="check_circle"
          trend={`${payables.filter(p => p.status === 'PAID' && new Date(p.due_date).getMonth() === new Date().getMonth()).length} contas pagas`}
          trendType="positive"
          onClick={() => handleKPIClick('pago')}
        />
        <DashboardCard
          title="Investido Hoje"
          amount={formatBRL(investments.filter(i => i.created_at.split('T')[0] === new Date().toISOString().split('T')[0]).reduce((acc, i) => acc + i.amount, 0))}
          icon="savings"
          trend={`${investments.filter(i => i.created_at.split('T')[0] === new Date().toISOString().split('T')[0]).length} novos aportes`}
          onClick={() => handleKPIClick('investido')}
        />
        <DashboardCard
          title="Recebido no Mês"
          amount={formatBRL(receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0))}
          icon="account_balance"
          trend={`${receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).length} recebimentos`}
          trendType="positive"
          onClick={() => handleKPIClick('recebido')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-8">
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-surface-highlight p-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
              <div>
                <h3 className="text-slate-900 dark:text-white text-xl font-black">Fluxo Mensal</h3>
                <p className="text-slate-500 dark:text-text-secondary text-sm font-medium">Entradas vs Saídas do Mês Atual</p>
              </div>
              <div className="bg-slate-50 dark:bg-surface-highlight/50 border border-slate-200 dark:border-surface-highlight rounded-2xl p-4 flex items-center gap-6 shadow-inner">
                <div>
                  <p className="text-slate-500 dark:text-[#9db9a6] text-[10px] font-black uppercase tracking-wider">Saldo Mensal</p>
                  <p className={`text-2xl font-black ${receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0) - payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0) >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {formatBRL(receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0) - payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0))}
                  </p>
                </div>
                <div className={`p-2 rounded-xl ${receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0) - payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0) >= 0 ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'}`}>
                  <span className="material-symbols-outlined text-3xl">
                    {receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0) - payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0) >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <span className="w-20 text-right text-xs font-black text-slate-400 dark:text-[#9db9a6] uppercase tracking-wider">Receitas</span>
                <div className="flex-1 h-12 bg-slate-50 dark:bg-surface-highlight/30 rounded-2xl relative overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-2xl flex items-center justify-end px-4 shadow-lg transition-all duration-1000"
                    style={{ width: `${Math.min(100, (receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0) / Math.max(1, receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0), payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0))) * 100)}%` }}
                  >
                    <span className="text-background-dark font-black text-sm whitespace-nowrap">
                      {formatBRL(receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="w-20 text-right text-xs font-black text-slate-400 dark:text-[#9db9a6] uppercase tracking-wider">Despesas</span>
                <div className="flex-1 h-12 bg-slate-50 dark:bg-surface-highlight/30 rounded-2xl relative overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-danger/60 to-danger rounded-2xl flex items-center justify-end px-4 shadow-lg transition-all duration-1000"
                    style={{ width: `${Math.min(100, (payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0) / Math.max(1, receivables.filter(r => r.status === 'RECEIVED' && new Date(r.due_date).getMonth() === new Date().getMonth()).reduce((acc, r) => acc + r.amount, 0), payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0))) * 100)}%` }}
                  >
                    <span className="text-white font-black text-sm whitespace-nowrap">
                      {formatBRL(payables.filter(p => new Date(p.due_date).getMonth() === new Date().getMonth()).reduce((acc, p) => acc + p.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-6">
              <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-primary shadow-sm"></div><span className="text-slate-500 dark:text-[#9db9a6] text-[10px] font-black uppercase">Entradas</span></div>
              <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-danger shadow-sm"></div><span className="text-slate-500 dark:text-[#9db9a6] text-[10px] font-black uppercase">Saídas</span></div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-8">
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-surface-highlight overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker flex justify-between items-center">
              <h3 className="text-slate-900 dark:text-white font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">account_balance</span> Saldos Bancários
              </h3>
              <span className="text-[10px] font-black bg-slate-200 dark:bg-surface-highlight text-slate-700 dark:text-[#9db9a6] px-2 py-1 rounded-md uppercase tracking-wider">Ativos</span>
            </div>
            <div className="p-2">
              {(() => {
                const normalize = (val: string | null) => val ? val.replace(/\D/g, '') : '';
                return banks.map((bank, i) => {
                  const companyOwner = companies.find(c => normalize(c.cnpj) === normalize(bank.owner_document));
                  const personOwner = people.find(p => normalize(p.cpf) === normalize(bank.owner_document));

                  const ownerDisplay = companyOwner?.name || bank.company?.name || personOwner?.nickname || bank.owner_name;

                  return (
                    <div key={bank.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-surface-highlight rounded-xl transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className={`size-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-black text-xs border-2 border-white dark:border-white/10 shadow-sm group-hover:scale-110 transition-transform`}>
                          {bank.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-slate-900 dark:text-white text-sm font-black">{bank.name}</p>
                          <p className="text-slate-400 dark:text-text-secondary text-[10px] font-black uppercase tracking-wider">
                            {ownerDisplay}
                          </p>
                        </div>
                      </div>
                      <p className="text-slate-900 dark:text-white font-black text-sm">-</p>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      <KPIModal
        isOpen={modalOpen}
        onClose={closeModal}
        data={selectedKPI}
      />
    </div>
  );
};

export default Dashboard;
