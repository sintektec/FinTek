
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, Contract, ContractStatus } from '../../types';
import { Plus, Search, Edit3, Trash2, Eye, Loader2, FileText } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-500 dark:bg-surface-highlight dark:text-text-secondary' },
    review: { label: 'Em Revisão', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    approved: { label: 'Aprovado', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    signed: { label: 'Assinado', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    active: { label: 'Ativo', cls: 'bg-success/10 text-success' },
    expired: { label: 'Expirado', cls: 'bg-danger/10 text-danger' },
    terminated: { label: 'Rescindido', cls: 'bg-danger/10 text-danger' },
    archived: { label: 'Arquivado', cls: 'bg-slate-100 text-slate-400 dark:bg-surface-highlight' }
};

const TYPE_LABEL: Record<string, string> = {
    service: 'Serviço', license: 'Licença', nda: 'NDA',
    partnership: 'Parceria', purchase: 'Compra', other: 'Outro'
};

const ALL_STATUSES: ContractStatus[] = ['draft', 'review', 'approved', 'signed', 'active', 'expired', 'terminated', 'archived'];

const ContractList: React.FC<{ user: User }> = ({ user }) => {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');

    useEffect(() => { fetchContracts(); }, []);

    const fetchContracts = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('contracts')
            .select(`
        id, contract_number, title, type, status, value, currency,
        effective_date, expiration_date, auto_renew, created_at, updated_at,
        company:companies(id, name),
        customer:customers(id, name),
        supplier:suppliers(id, name)
      `)
            .order('created_at', { ascending: false });

        if (data) setContracts(data);
        setLoading(false);
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Excluir o contrato "${title}"?`)) return;
        await supabase.from('contracts').delete().eq('id', id);
        fetchContracts();
    };

    const handleStatusChange = async (id: string, newStatus: ContractStatus) => {
        await supabase.from('contracts').update({ status: newStatus }).eq('id', id);
        // Log activity
        const { data: { user: authUser } } = await supabase.auth.getUser();
        await supabase.from('contract_activities').insert([{
            contract_id: id,
            user_id: authUser?.id,
            action: 'status_changed',
            description: `Status alterado para "${STATUS_CONFIG[newStatus]?.label || newStatus}"`
        }]);
        fetchContracts();
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const partyName = (c: any) => c.company?.name || c.customer?.name || c.supplier?.name || '—';

    const filtered = contracts.filter(c => {
        const matchSearch =
            c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            partyName(c).toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Todos os Contratos</h1>
                    <p className="text-slate-500 dark:text-text-secondary text-sm font-medium">{contracts.length} contratos cadastrados</p>
                </div>
                {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
                    <button
                        onClick={() => navigate('/contratos/novo')}
                        className="px-8 h-12 rounded-xl bg-primary text-background-dark font-black shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all"
                    >
                        <Plus className="w-5 h-5" /> Novo Contrato
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="relative group w-full md:max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por título, número ou parte..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm text-sm"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {(['all', ...ALL_STATUSES] as const).map(s => {
                        const cfg = s === 'all' ? { label: 'Todos', cls: '' } : STATUS_CONFIG[s];
                        const isActive = statusFilter === s;
                        return (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-primary text-white shadow' : 'bg-slate-100 dark:bg-surface-dark text-slate-500 dark:text-text-secondary hover:bg-slate-200 dark:hover:bg-surface-highlight border border-slate-200 dark:border-surface-highlight'}`}
                            >
                                {cfg?.label || s}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-surface-highlight/30 border-b border-slate-100 dark:border-surface-highlight">
                                {['Contrato', 'Parte', 'Tipo', 'Valor', 'Vigência', 'Status', 'Ações'].map(h => (
                                    <th key={h} className={`px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em] ${h === 'Ações' ? 'text-center' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center">
                                        <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                        <p className="text-slate-400 font-medium">Nenhum contrato encontrado.</p>
                                    </td>
                                </tr>
                            ) : filtered.map(c => {
                                const s = STATUS_CONFIG[c.status] || { label: c.status, cls: '' };
                                return (
                                    <tr key={c.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                    <FileText className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{c.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium tracking-wider">{c.contract_number}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-text-secondary font-medium">{partyName(c)}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-surface-highlight text-slate-500 dark:text-text-secondary uppercase tracking-widest">
                                                {TYPE_LABEL[c.type] || c.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-sm text-slate-900 dark:text-white">{fmt(c.value)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-text-secondary">
                                            {c.expiration_date ? new Date(c.expiration_date).toLocaleDateString('pt-BR') : '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') ? (
                                                <select
                                                    title="Alterar status do contrato"
                                                    value={c.status}
                                                    onChange={e => handleStatusChange(c.id, e.target.value as ContractStatus)}
                                                    className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest border-0 outline-none cursor-pointer ${s.cls}`}
                                                >
                                                    {ALL_STATUSES.map(st => (
                                                        <option key={st} value={st}>{STATUS_CONFIG[st]?.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${s.cls}`}>{s.label}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => navigate(`/contratos/${c.id}`)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Visualizar">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
                                                    <>
                                                        <button onClick={() => navigate(`/contratos/editar/${c.id}`)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Editar">
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(c.id, c.title)} className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-all" title="Excluir">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ContractList;
