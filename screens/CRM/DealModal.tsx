import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Building2, User2, AlignLeft, CalendarDays, DollarSign, FileText, CheckCircle2, XCircle, Send } from 'lucide-react';

interface Stage {
    id: string;
    name: string;
}

interface DealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    dealId?: string | null;
    stageId?: string;
}

const DealModal: React.FC<DealModalProps> = ({ isOpen, onClose, onSave, dealId, stageId }) => {
    const [stages, setStages] = useState<Stage[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        value: '',
        stage_id: '',
        expected_close_date: '',
        company_id: '',
        customer_id: '',
        workflow_status: 'pending' as any,
        justification: '',
        proposal_url: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchDependencies();
            if (dealId) {
                fetchDealData();
            } else {
                setFormData({
                    title: '',
                    description: '',
                    value: '',
                    stage_id: stageId || '',
                    expected_close_date: '',
                    company_id: '',
                    customer_id: '',
                    workflow_status: 'pending',
                    justification: '',
                    proposal_url: ''
                });
            }
        }
    }, [isOpen, dealId, stageId]);

    const fetchDependencies = async () => {
        try {
            const [stagesRes, compRes, custRes] = await Promise.all([
                supabase.from('crm_stages').select('id, name').order('order_index'),
                supabase.from('companies').select('id, name, trade_name').eq('is_active', true),
                supabase.from('customers').select('id, name, trade_name').eq('is_active', true)
            ]);

            if (stagesRes.data) {
                setStages(stagesRes.data);
                if (!formData.stage_id && !stageId && stagesRes.data.length > 0) {
                    setFormData(prev => ({ ...prev, stage_id: stagesRes.data[0].id }));
                }
            }
            if (compRes.data) setCompanies(compRes.data);
            if (custRes.data) setCustomers(custRes.data);
        } catch (error) {
            console.error('Error fetching modal dependencies:', error);
        }
    };

    const fetchDealData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('crm_deals').select('*').eq('id', dealId).single();
            if (data && !error) {
                setFormData({
                    title: data.title || '',
                    description: data.description || '',
                    value: data.value ? data.value.toString() : '',
                    stage_id: data.stage_id || '',
                    expected_close_date: data.expected_close_date ? data.expected_close_date.split('T')[0] : '',
                    company_id: data.company_id || '',
                    customer_id: data.customer_id || '',
                    workflow_status: data.workflow_status || 'pending',
                    justification: data.justification || '',
                    proposal_url: data.proposal_url || ''
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const payload: any = {
                title: formData.title,
                description: formData.description || null,
                value: formData.value ? parseFloat(formData.value) : 0,
                stage_id: formData.stage_id,
                expected_close_date: formData.expected_close_date || null,
                company_id: formData.company_id || null,
                customer_id: formData.customer_id || null,
                workflow_status: formData.workflow_status,
                justification: formData.justification || null,
                proposal_url: formData.proposal_url || null
            };

            if (dealId) {
                payload.updated_at = new Date().toISOString();
                await supabase.from('crm_deals').update(payload).eq('id', dealId);
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                payload.user_id = user?.id;
                await supabase.from('crm_deals').insert([payload]);
            }
            onSave();
        } catch (err) {
            console.error('Erro ao salvar negócio:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleWorkflowAction = async (action: 'approve' | 'reject' | 'send_proposal') => {
        const currentStage = stages.find(s => s.id === formData.stage_id);
        if (!currentStage) return;

        let nextStageId = formData.stage_id;
        let newStatus = formData.workflow_status;

        const stageName = currentStage.name.toLowerCase();

        if (stageName.includes('qualif')) {
            if (action === 'approve') {
                const step3 = stages.find(s => s.name.toLowerCase().includes('propos'));
                if (step3) nextStageId = step3.id;
                newStatus = 'approved';
            } else if (action === 'reject') {
                newStatus = 'rejected';
            }
        } else if (stageName.includes('propos')) {
            if (action === 'send_proposal') {
                const step4 = stages.find(s => s.name.toLowerCase().includes('nego'));
                if (step4) nextStageId = step4.id;
                newStatus = 'proposal_sent';
            }
        } else if (stageName.includes('nego')) {
            if (action === 'approve') {
                const step5 = stages.find(s => s.name.toLowerCase().includes('contra'));
                if (step5) nextStageId = step5.id;
                newStatus = 'approved';
            } else if (action === 'reject') {
                newStatus = 'rejected';
            }
        }

        // Apply changes locally
        setFormData(prev => ({ ...prev, stage_id: nextStageId, workflow_status: newStatus }));

        // Finalize by calling handleSubmit directly for better UX
        const finalPayload: any = {
            title: formData.title,
            description: formData.description || null,
            value: formData.value ? parseFloat(formData.value) : 0,
            stage_id: nextStageId,
            expected_close_date: formData.expected_close_date || null,
            company_id: formData.company_id || null,
            customer_id: formData.customer_id || null,
            workflow_status: newStatus,
            justification: formData.justification || null,
            proposal_url: formData.proposal_url || null,
            updated_at: new Date().toISOString()
        };

        setLoading(true);
        await supabase.from('crm_deals').update(finalPayload).eq('id', dealId);
        onSave();
        setLoading(false);
    };

    if (!isOpen) return null;

    const currentStage = stages.find(s => s.id === (formData.stage_id || stageId));
    const stageNameNormalized = currentStage?.name.toLowerCase() || '';

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col pt-safe animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-surface-highlight flex justify-between items-center bg-slate-50 dark:bg-surface-dark shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {dealId ? 'Editar Negócio' : 'Novo Negócio'}
                    </h2>
                    <button
                        title="Fechar modal"
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-surface-highlight rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form id="deal-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Title & Value */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Título do Negócio *
                                </label>
                                <input
                                    required
                                    type="text"
                                    title="Título do negócio"
                                    placeholder="Ex: Licenciamento Office 365"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                    <DollarSign className="w-4 h-4 text-primary" /> Valor Estimado
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    title="Valor estimado"
                                    placeholder="0,00"
                                    value={formData.value}
                                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white font-bold"
                                />
                            </div>
                        </div>

                        {/* Stage & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Estágio no Funil *</label>
                                <select
                                    title="Selecionar estágio"
                                    required
                                    value={formData.stage_id}
                                    onChange={e => setFormData({ ...formData, stage_id: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
                                >
                                    {stages.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                    <CalendarDays className="w-4 h-4 text-slate-400" /> Fechamento Previsto
                                </label>
                                <input
                                    title="Data de fechamento prevista"
                                    type="date"
                                    value={formData.expected_close_date}
                                    onChange={e => setFormData({ ...formData, expected_close_date: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Link to Entity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-surface-highlight/30">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                    <Building2 className="w-4 h-4 text-slate-400" /> Empresa (B2B)
                                </label>
                                <select
                                    title="Selecionar empresa"
                                    value={formData.company_id}
                                    onChange={e => setFormData({ ...formData, company_id: e.target.value, customer_id: '' })}
                                    className="w-full px-4 py-2 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
                                >
                                    <option value="">Nenhuma...</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.trade_name || c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                    <User2 className="w-4 h-4 text-slate-400" /> Cliente / Contato (B2C)
                                </label>
                                <select
                                    title="Selecionar cliente"
                                    value={formData.customer_id}
                                    onChange={e => setFormData({ ...formData, customer_id: e.target.value, company_id: '' })}
                                    className="w-full px-4 py-2 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
                                >
                                    <option value="">Nenhum...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.trade_name || c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                <AlignLeft className="w-4 h-4 text-slate-400" /> Escopo / Anotações
                            </label>
                            <textarea
                                rows={4}
                                title="Escopo e anotações"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descreva o escopo da oportunidade, necessidades do cliente, etc."
                                className="w-full px-4 py-3 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white resize-none"
                            />
                        </div>

                        {/* Workflow Decision Gates */}
                        {(stageNameNormalized.includes('qualif') || stageNameNormalized.includes('nego') || stageNameNormalized.includes('propos')) && (
                            <div className="pt-6 border-t border-slate-200 dark:border-surface-highlight space-y-4">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-primary" /> Ações do Fluxo: {currentStage?.name}
                                </h3>

                                {stageNameNormalized.includes('propos') && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Link da Proposta / Documento</label>
                                            <input
                                                title="Link da proposta"
                                                type="text"
                                                placeholder="https://link-da-proposta.pdf"
                                                value={formData.proposal_url}
                                                onChange={e => setFormData({ ...formData, proposal_url: e.target.value })}
                                                className="w-full px-4 py-2 bg-slate-50 dark:bg-surface-dark border border-slate-300 dark:border-surface-highlight/50 rounded-xl text-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleWorkflowAction('send_proposal')}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all shadow-md"
                                        >
                                            <Send className="w-4 h-4" /> Marcar como Proposta Enviada
                                        </button>
                                    </div>
                                )}

                                {(stageNameNormalized.includes('qualif') || stageNameNormalized.includes('nego')) && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Justificativa (obrigatório se recusar)</label>
                                            <textarea
                                                title="Justificativa da decisão"
                                                rows={2}
                                                value={formData.justification}
                                                onChange={e => setFormData({ ...formData, justification: e.target.value })}
                                                placeholder="Motivo da aprovação ou recusa..."
                                                className="w-full px-4 py-2 bg-slate-50 dark:bg-surface-dark border border-slate-300 dark:border-surface-highlight/50 rounded-xl text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleWorkflowAction('approve')}
                                                className="flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-md"
                                            >
                                                <CheckCircle2 className="w-4 h-4" /> Aprovar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleWorkflowAction('reject')}
                                                className="flex items-center justify-center gap-2 py-3 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-xl font-bold transition-all border border-danger/20"
                                            >
                                                <XCircle className="w-4 h-4" /> Recusar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-dark flex justify-end gap-3 shrink-0">
                    {dealId && (
                        <button
                            type="button"
                            onClick={() => window.location.href = `#/contratos/novo?deal=${dealId}`}
                            className="mr-auto px-5 py-2.5 rounded-xl font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-2"
                        >
                            <FileText className="w-5 h-5" /> Gerar Contrato
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-text-secondary hover:bg-slate-200 dark:hover:bg-surface-highlight transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="deal-form"
                        disabled={loading}
                        className="bg-primary hover:bg-primary-hover text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center font-bold"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Negócio'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DealModal;
