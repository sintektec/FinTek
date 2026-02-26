
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, Contract, ContractSignatory, ContractActivity, ContractStatus } from '../../types';
import {
    ArrowLeft, Edit3, Loader2, FileText, Users, Clock, Bell,
    CheckCircle, XCircle, Plus, Trash2
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600 dark:bg-surface-highlight dark:text-text-secondary' },
    review: { label: 'Em Revisão', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    approved: { label: 'Aprovado', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    signed: { label: 'Assinado', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    active: { label: 'Ativo', cls: 'bg-success/10 text-success' },
    expired: { label: 'Expirado', cls: 'bg-danger/10 text-danger' },
    terminated: { label: 'Rescindido', cls: 'bg-danger/10 text-danger' },
    archived: { label: 'Arquivado', cls: 'bg-slate-100 text-slate-400' }
};

const TYPE_LABEL: Record<string, string> = {
    service: 'Serviço', license: 'Licença', nda: 'NDA',
    partnership: 'Parceria', purchase: 'Compra', other: 'Outro'
};

type TabType = 'overview' | 'signatories' | 'history' | 'alerts';

const ContractDetail: React.FC<{ user: User }> = ({ user }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [contract, setContract] = useState<any>(null);
    const [signatories, setSignatories] = useState<ContractSignatory[]>([]);
    const [activities, setActivities] = useState<ContractActivity[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabType>('overview');
    const [newSig, setNewSig] = useState({ name: '', email: '', role: 'signer' as const });
    const [addingSig, setAddingSig] = useState(false);

    useEffect(() => { if (id) fetchAll(); }, [id]);

    const fetchAll = async () => {
        setLoading(true);
        const [cRes, sRes, aRes, alRes] = await Promise.all([
            supabase.from('contracts').select(`
        *, company:companies(id,name), customer:customers(id,name), supplier:suppliers(id,name),
        crm_deal:crm_deals(id,title)
      `).eq('id', id!).single(),
            supabase.from('contract_signatories').select('*').eq('contract_id', id!).order('signing_order'),
            supabase.from('contract_activities').select('*').eq('contract_id', id!).order('created_at', { ascending: false }),
            supabase.from('contract_alerts').select('*').eq('contract_id', id!).order('trigger_date')
        ]);
        if (cRes.data) setContract(cRes.data);
        if (sRes.data) setSignatories(sRes.data);
        if (aRes.data) setActivities(aRes.data);
        if (alRes.data) setAlerts(alRes.data);
        setLoading(false);
    };

    const handleStatusChange = async (newStatus: ContractStatus) => {
        await supabase.from('contracts').update({ status: newStatus }).eq('id', id!);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        await supabase.from('contract_activities').insert([{
            contract_id: id,
            user_id: authUser?.id,
            action: 'status_changed',
            description: `Status alterado para "${STATUS_CONFIG[newStatus]?.label || newStatus}"`
        }]);
        fetchAll();
    };

    const handleAddSignatory = async () => {
        if (!newSig.name || !newSig.email) return;
        setAddingSig(true);
        await supabase.from('contract_signatories').insert([{
            contract_id: id,
            name: newSig.name,
            email: newSig.email,
            role: newSig.role,
            signing_order: signatories.length + 1
        }]);
        setNewSig({ name: '', email: '', role: 'signer' });
        setAddingSig(false);
        fetchAll();
    };

    const handleMarkSigned = async (sigId: string) => {
        await supabase.from('contract_signatories')
            .update({ status: 'signed', signed_at: new Date().toISOString() })
            .eq('id', sigId);
        fetchAll();
    };

    const handleDeleteSignatory = async (sigId: string) => {
        await supabase.from('contract_signatories').delete().eq('id', sigId);
        fetchAll();
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const partyName = (c: any) => c?.company?.name || c?.customer?.name || c?.supplier?.name || c?.party_name || '—';

    if (loading) return (
        <div className="flex-1 flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
    );

    if (!contract) return (
        <div className="p-10 text-center text-slate-400">Contrato não encontrado.</div>
    );

    const s = STATUS_CONFIG[contract.status] || { label: contract.status, cls: '' };

    const TABS: { id: TabType; label: string; icon: any }[] = [
        { id: 'overview', label: 'Visão Geral', icon: FileText },
        { id: 'signatories', label: `Signatários (${signatories.length})`, icon: Users },
        { id: 'history', label: `Histórico (${activities.length})`, icon: Clock },
        { id: 'alerts', label: `Alertas (${alerts.length})`, icon: Bell }
    ];

    return (
        <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
            {/* Back + header */}
            <div>
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-6 transition-colors font-bold">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${s.cls}`}>{s.label}</span>
                            <span className="text-xs text-slate-400 font-medium">{contract.contract_number}</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white">{contract.title}</h1>
                        <p className="text-slate-500 dark:text-text-secondary mt-1">{partyName(contract)} · {TYPE_LABEL[contract.type] || contract.type}</p>
                    </div>
                    {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
                        <div className="flex items-center gap-3">
                            <select
                                title="Alterar status do contrato"
                                value={contract.status}
                                onChange={e => handleStatusChange(e.target.value as ContractStatus)}
                                className="h-10 px-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            >
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => navigate(`/contratos/editar/${contract.id}`)}
                                className="flex items-center gap-2 px-5 h-10 bg-primary text-white rounded-xl font-bold text-sm hover:scale-[1.02] transition-all shadow"
                            >
                                <Edit3 className="w-4 h-4" /> Editar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-surface-highlight">
                <div className="flex gap-1">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-primary'}`}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {tab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Info card */}
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Informações Gerais</h3>
                        {[
                            { label: 'Valor', value: fmt(contract.value) },
                            { label: 'Vigência Início', value: contract.effective_date ? new Date(contract.effective_date).toLocaleDateString('pt-BR') : '—' },
                            { label: 'Vigência Fim', value: contract.expiration_date ? new Date(contract.expiration_date).toLocaleDateString('pt-BR') : '—' },
                            { label: 'Renovação Auto.', value: contract.auto_renew ? `Sim (${contract.renewal_months} meses)` : 'Não' },
                            { label: 'Negócio CRM', value: contract.crm_deal?.title || '—' },
                            { label: 'Cadastrado em', value: new Date(contract.created_at).toLocaleDateString('pt-BR') }
                        ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between items-start py-2 border-b border-slate-100 dark:border-surface-highlight last:border-0">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white text-right max-w-[60%]">{value}</span>
                            </div>
                        ))}
                    </div>
                    {/* Content/scope */}
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Escopo / Cláusulas</h3>
                        <p className="text-sm text-slate-600 dark:text-text-secondary whitespace-pre-wrap leading-relaxed">
                            {contract.content || 'Nenhum conteúdo registrado.'}
                        </p>
                        {contract.notes && (
                            <>
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 pt-2">Observações Internas</h3>
                                <p className="text-sm text-slate-500 dark:text-text-secondary whitespace-pre-wrap italic">{contract.notes}</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {tab === 'signatories' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl overflow-hidden">
                        {signatories.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">Nenhum signatário cadastrado.</div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-surface-highlight/30 border-b border-slate-100 dark:border-surface-highlight">
                                    <tr>
                                        {['#', 'Nome', 'E-mail', 'Papel', 'Status', 'Ações'].map(h => (
                                            <th key={h} className="px-5 py-4 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-widest text-left">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight">
                                    {signatories.map(sig => (
                                        <tr key={sig.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                            <td className="px-5 py-3 text-sm font-bold text-slate-400">{sig.signing_order}</td>
                                            <td className="px-5 py-3 font-bold text-slate-900 dark:text-white text-sm">{sig.name}</td>
                                            <td className="px-5 py-3 text-sm text-slate-500">{sig.email}</td>
                                            <td className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">{sig.role}</td>
                                            <td className="px-5 py-3">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${sig.status === 'signed' ? 'bg-success/10 text-success' : sig.status === 'declined' ? 'bg-danger/10 text-danger' : 'bg-slate-100 text-slate-500 dark:bg-surface-highlight'}`}>
                                                    {sig.status === 'signed' ? 'Assinado' : sig.status === 'declined' ? 'Recusado' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex gap-2">
                                                    {sig.status === 'pending' && (
                                                        <button onClick={() => handleMarkSigned(sig.id)} title="Marcar como assinado" className="p-1.5 hover:bg-success/10 text-slate-400 hover:text-success rounded-lg transition-all">
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDeleteSignatory(sig.id)} title="Remover" className="p-1.5 hover:bg-danger/10 text-slate-400 hover:text-danger rounded-lg transition-all">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {/* Add signatory */}
                    {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-5 flex flex-col md:flex-row gap-3 items-end">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome</label>
                                <input value={newSig.name} onChange={e => setNewSig(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail</label>
                                <input value={newSig.email} onChange={e => setNewSig(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" type="email" className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div className="w-40 space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Papel</label>
                                <select
                                    title="Selecionar papel do signatário"
                                    value={newSig.role}
                                    onChange={e => setNewSig(p => ({ ...p, role: e.target.value as any }))}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none"
                                >
                                    <option value="signer">Signatário</option>
                                    <option value="approver">Aprovador</option>
                                    <option value="witness">Testemunha</option>
                                </select>
                            </div>
                            <button onClick={handleAddSignatory} disabled={addingSig} className="px-5 h-10 bg-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:scale-[1.02] transition-all shadow">
                                <Plus className="w-4 h-4" /> Adicionar
                            </button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'history' && (
                <div className="space-y-3">
                    {activities.length === 0 ? (
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-10 text-center text-slate-400">Nenhuma atividade registrada.</div>
                    ) : activities.map(a => (
                        <div key={a.id} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-xl px-5 py-4 flex items-start gap-4">
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Clock className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{a.description || a.action}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{new Date(a.created_at).toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'alerts' && (
                <div className="space-y-3">
                    {alerts.length === 0 ? (
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-10 text-center text-slate-400">Nenhum alerta configurado.</div>
                    ) : alerts.map(a => {
                        const daysLeft = Math.ceil((new Date(a.trigger_date).getTime() - Date.now()) / 86400000);
                        return (
                            <div key={a.id} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${daysLeft <= 30 ? 'bg-danger/10' : 'bg-warning/10'}`}>
                                        <Bell className={`w-4 h-4 ${daysLeft <= 30 ? 'text-danger' : 'text-warning'}`} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{new Date(a.trigger_date).toLocaleDateString('pt-BR')} · {a.type}</p>
                                    </div>
                                </div>
                                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${daysLeft <= 0 ? 'bg-danger/10 text-danger' : daysLeft <= 30 ? 'bg-warning/10 text-warning' : 'bg-slate-100 text-slate-500'}`}>
                                    {daysLeft <= 0 ? 'Vencido' : `${daysLeft}d`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ContractDetail;
