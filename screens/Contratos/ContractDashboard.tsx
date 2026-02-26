
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import {
    FileText, TrendingUp, Clock, AlertTriangle,
    Plus, ArrowRight, CheckCircle, RefreshCw
} from 'lucide-react';

const ContractDashboard: React.FC<{ user: User }> = ({ user }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        total: 0, active: 0, expiring: 0, draft: 0,
        totalValue: 0, renewals: 0
    });
    const [expiring, setExpiring] = useState<any[]>([]);
    const [recent, setRecent] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
            const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

            const [allRes, expiringRes, recentRes] = await Promise.all([
                supabase.from('contracts').select('id, status, value, auto_renew, expiration_date'),
                supabase.from('contracts')
                    .select('id, title, contract_number, expiration_date, value, status, company_id, customer_id')
                    .gte('expiration_date', today)
                    .lte('expiration_date', in90)
                    .in('status', ['active', 'signed'])
                    .order('expiration_date', { ascending: true })
                    .limit(5),
                supabase.from('contracts')
                    .select('id, title, contract_number, status, value, created_at, company_id, customer_id')
                    .order('created_at', { ascending: false })
                    .limit(5)
            ]);

            if (allRes.data) {
                const all = allRes.data;
                const active = all.filter(c => c.status === 'active');
                const draft = all.filter(c => c.status === 'draft');
                const exp30 = all.filter(c => c.expiration_date >= today && c.expiration_date <= in30 && ['active', 'signed'].includes(c.status));
                const renewing = all.filter(c => c.auto_renew && c.status === 'active');
                setStats({
                    total: all.length,
                    active: active.length,
                    expiring: exp30.length,
                    draft: draft.length,
                    totalValue: active.reduce((s, c) => s + Number(c.value || 0), 0),
                    renewals: renewing.length
                });
            }
            if (expiringRes.data) setExpiring(expiringRes.data);
            if (recentRes.data) setRecent(recentRes.data);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

    const statusLabel: Record<string, { label: string; cls: string }> = {
        draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-500 dark:bg-surface-highlight dark:text-text-secondary' },
        review: { label: 'Em Revisão', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
        approved: { label: 'Aprovado', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
        signed: { label: 'Assinado', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
        active: { label: 'Ativo', cls: 'bg-success/10 text-success' },
        expired: { label: 'Expirado', cls: 'bg-danger/10 text-danger' },
        terminated: { label: 'Rescindido', cls: 'bg-danger/10 text-danger' },
        archived: { label: 'Arquivado', cls: 'bg-slate-100 text-slate-400' }
    };

    return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Contratos</h1>
                    <p className="text-slate-600 dark:text-text-secondary text-base font-medium">Gestão do ciclo de vida contratual.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/contratos/lista')}
                        className="px-6 h-12 rounded-xl border border-slate-200 dark:border-surface-highlight text-slate-600 dark:text-text-secondary font-black text-xs tracking-widest hover:bg-slate-50 dark:hover:bg-surface-highlight transition-all"
                    >
                        VER TODOS
                    </button>
                    {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
                        <button
                            onClick={() => navigate('/contratos/novo')}
                            className="px-8 h-12 rounded-xl bg-primary text-background-dark font-black shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all"
                        >
                            <Plus className="w-5 h-5" /> Novo Contrato
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Contratos Ativos', value: stats.active, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
                    { label: 'Valor Contratado', value: fmt(stats.totalValue), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'A Vencer (30d)', value: stats.expiring, icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
                    { label: 'Renovação Auto.', value: stats.renewals, icon: RefreshCw, color: 'text-purple-500', bg: 'bg-purple-500/10' }
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
                        <div className={`size-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                            <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{loading ? '—' : kpi.value}</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-text-secondary uppercase tracking-widest mt-0.5">{kpi.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiring soon */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl overflow-hidden shadow-sm">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-surface-highlight flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-warning" />
                            <h2 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-widest">A Vencer em 90 dias</h2>
                        </div>
                        <button onClick={() => navigate('/contratos/lista')} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                            Ver todos <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-surface-highlight">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400">Carregando...</div>
                        ) : expiring.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">Nenhum contrato a vencer em 90 dias 🎉</div>
                        ) : expiring.map(c => {
                            const days = daysUntil(c.expiration_date);
                            return (
                                <div key={c.id} onClick={() => navigate(`/contratos/${c.id}`)} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                    <div>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">{c.title}</p>
                                        <p className="text-xs text-slate-400 font-medium">{c.contract_number}</p>
                                    </div>
                                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${days <= 30 ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                                        {days}d
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent contracts */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl overflow-hidden shadow-sm">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-surface-highlight flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-widest">Recentes</h2>
                        </div>
                        <button onClick={() => navigate('/contratos/lista')} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                            Ver todos <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-surface-highlight">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400">Carregando...</div>
                        ) : recent.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">Nenhum contrato ainda.</div>
                        ) : recent.map(c => {
                            const s = statusLabel[c.status] || { label: c.status, cls: '' };
                            return (
                                <div key={c.id} onClick={() => navigate(`/contratos/${c.id}`)} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                    <div>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">{c.title}</p>
                                        <p className="text-xs text-slate-400 font-medium">{c.contract_number} · {fmt(c.value)}</p>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${s.cls}`}>{s.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContractDashboard;
