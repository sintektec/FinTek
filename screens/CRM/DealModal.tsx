import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Building2, User2, AlignLeft, CalendarDays, DollarSign } from 'lucide-react';

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
        customer_id: ''
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
                    customer_id: ''
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
                    customer_id: data.customer_id || ''
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload: any = {
                title: formData.title,
                description: formData.description || null,
                value: formData.value ? parseFloat(formData.value) : 0,
                stage_id: formData.stage_id,
                expected_close_date: formData.expected_close_date || null,
                company_id: formData.company_id || null,
                customer_id: formData.customer_id || null
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col pt-safe animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-surface-highlight flex justify-between items-center bg-slate-50 dark:bg-surface-dark shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {dealId ? 'Editar Negócio' : 'Novo Negócio'}
                    </h2>
                    <button
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
                                    value={formData.company_id}
                                    onChange={e => setFormData({ ...formData, company_id: e.target.value, customer_id: '' })} // Limpa cliente se escolher empresa
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
                                    value={formData.customer_id}
                                    onChange={e => setFormData({ ...formData, customer_id: e.target.value, company_id: '' })} // Limpa empresa se escolher cliente
                                    className="w-full px-4 py-2 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
                                >
                                    <option value="">Nenhum...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.trade_name || c.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">* Associe o negócio a apenas um contato ou empresa.</p>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                <AlignLeft className="w-4 h-4 text-slate-400" /> Escopo / Anotações
                            </label>
                            <textarea
                                rows={4}
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descreva o escopo da oportunidade, necessidades do cliente, etc."
                                className="w-full px-4 py-3 bg-white dark:bg-surface-highlight border border-slate-300 dark:border-surface-highlight/50 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none dark:text-white resize-none"
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-dark flex justify-end gap-3 shrink-0">
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
                        className="bg-primary hover:bg-primary-hover text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Negócio'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default DealModal;
