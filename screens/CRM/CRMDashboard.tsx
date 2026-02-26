import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CRMDeal } from '../../types';
import {
    Users,
    UserCheck,
    FileText,
    Handshake,
    TrendingUp,
    TrendingDown,
    Clock,
    XCircle,
    CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

const CRMDashboard = () => {
    const [stats, setStats] = useState({
        prospec: { active: 0, rejected: 0 },
        qualif: { active: 0, rejected: 0 },
        proposal: { active: 0 },
        negotiation: { approved: 0, rejected: 0 },
        totalValue: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const { data: deals, error } = await supabase
                .from('crm_deals')
                .select(`
                    *,
                    stage:crm_stages(name)
                `);

            if (error) throw error;

            const newStats = {
                prospec: { active: 0, rejected: 0 },
                qualif: { active: 0, rejected: 0 },
                proposal: { active: 0 },
                negotiation: { approved: 0, rejected: 0 },
                totalValue: 0
            };

            deals.forEach((deal: any) => {
                const stageName = deal.stage?.name.toLowerCase();
                const status = deal.workflow_status;

                if (stageName?.includes('prospec')) {
                    if (status === 'rejected') newStats.prospec.rejected++;
                    else newStats.prospec.active++;
                } else if (stageName?.includes('quali')) {
                    if (status === 'rejected') newStats.qualif.rejected++;
                    else newStats.qualif.active++;
                } else if (stageName?.includes('propos')) {
                    newStats.proposal.active++;
                } else if (stageName?.includes('negoc')) {
                    if (status === 'approved') newStats.negotiation.approved++;
                    else if (status === 'rejected') newStats.negotiation.rejected++;
                }

                if (status !== 'rejected') {
                    newStats.totalValue += Number(deal.value || 0);
                }
            });

            setStats(newStats);
        } catch (err) {
            console.error('Error fetching CRM stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, active, inactive, inactiveLabel, icon: Icon, color }: any) => (
        <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-surface-highlight flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
                    <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
                </div>
                <div className="text-right">
                    <p className="text-xs font-black text-slate-400 dark:text-text-secondary uppercase tracking-widest">{title}</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{active}</p>
                </div>
            </div>

            {inactive !== undefined && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-surface-highlight/30">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{inactiveLabel}</span>
                    <span className="text-xs font-black text-danger flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> {inactive}
                    </span>
                </div>
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="animate-pulse space-y-8 p-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-surface-highlight rounded-2xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 bg-slate-50 dark:bg-background-dark min-h-screen">
            <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">CRM Dashboard</h1>
                <p className="text-slate-500 dark:text-text-secondary font-semibold mt-1">Visão geral do funil de vendas e performance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Prospecções"
                    active={stats.prospec.active}
                    inactive={stats.prospec.rejected}
                    inactiveLabel="Recusadas"
                    icon={Users}
                    color="bg-slate-400"
                />
                <StatCard
                    title="Qualificações"
                    active={stats.qualif.active}
                    inactive={stats.qualif.rejected}
                    inactiveLabel="Recusadas"
                    icon={UserCheck}
                    color="bg-amber-400"
                />
                <StatCard
                    title="Propostas"
                    active={stats.proposal.active}
                    icon={FileText}
                    color="bg-blue-500"
                />
                <StatCard
                    title="Negociações"
                    active={stats.negotiation.approved}
                    inactive={stats.negotiation.rejected}
                    inactiveLabel="Recusadas"
                    icon={Handshake}
                    color="bg-violet-500"
                />
            </div>

            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-8 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/30">
                        <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-primary uppercase tracking-widest">Valor do Pipeline Ativo</p>
                        <p className="text-4xl font-black text-slate-900 dark:text-white mt-1">
                            {formatCurrency(stats.totalValue)}
                        </p>
                    </div>
                </div>
                <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-slate-500 dark:text-text-secondary max-w-[200px]">
                        Baseado em todos os negócios ativos no funil, excluindo os recusados.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CRMDashboard;
