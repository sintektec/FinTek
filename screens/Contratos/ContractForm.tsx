
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, ContractType, ContractStatus } from '../../types';
import { ArrowLeft, Save, Loader2, RefreshCw } from 'lucide-react';

const TYPE_OPTIONS: { value: ContractType; label: string }[] = [
    { value: 'service', label: 'Prestação de Serviço' },
    { value: 'license', label: 'Licenciamento de Software' },
    { value: 'nda', label: 'NDA / Confidencialidade' },
    { value: 'partnership', label: 'Parceria / Colaboração' },
    { value: 'purchase', label: 'Compra e Venda' },
    { value: 'other', label: 'Outro' }
];

const STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
    { value: 'draft', label: 'Rascunho' },
    { value: 'review', label: 'Em Revisão' },
    { value: 'approved', label: 'Aprovado' },
    { value: 'signed', label: 'Assinado' },
    { value: 'active', label: 'Ativo' },
    { value: 'expired', label: 'Expirado' },
    { value: 'terminated', label: 'Rescindido' },
    { value: 'archived', label: 'Arquivado' }
];

const INITIAL = {
    title: '', type: 'service' as ContractType, status: 'draft' as ContractStatus,
    crm_deal_id: '', company_id: '', customer_id: '', supplier_id: '',
    party_name: '', party_doc: '',
    value: '', currency: 'BRL',
    effective_date: '', expiration_date: '',
    auto_renew: false, renewal_months: 12,
    content: '', notes: ''
};

const ContractForm: React.FC<{ user: User }> = ({ user }) => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState({ ...INITIAL });
    const [companies, setCompanies] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchLists();
        if (isEdit) loadContract();
    }, [id]);

    // Pre-fill from CRM deal query param
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const dealId = params.get('deal');
        if (dealId && deals.length > 0) {
            const deal = deals.find(d => d.id === dealId);
            if (deal) {
                setFormData(f => ({
                    ...f,
                    crm_deal_id: dealId,
                    title: deal.title || f.title,
                    value: deal.value ? String(deal.value) : f.value,
                    company_id: deal.company_id || '',
                    customer_id: deal.customer_id || ''
                }));
            }
        }
    }, [deals]);

    const fetchLists = async () => {
        const [compRes, custRes, suppRes, dealRes] = await Promise.all([
            supabase.from('companies').select('id, name').order('name'),
            supabase.from('customers').select('id, name').order('name'),
            supabase.from('suppliers').select('id, name').order('name'),
            supabase.from('crm_deals').select('id, title, value, company_id, customer_id').order('title')
        ]);
        if (compRes.data) setCompanies(compRes.data);
        if (custRes.data) setCustomers(custRes.data);
        if (suppRes.data) setSuppliers(suppRes.data);
        if (dealRes.data) setDeals(dealRes.data);
    };

    const loadContract = async () => {
        setLoading(true);
        const { data } = await supabase.from('contracts').select('*').eq('id', id!).single();
        if (data) {
            setFormData({
                title: data.title || '',
                type: data.type || 'service',
                status: data.status || 'draft',
                crm_deal_id: data.crm_deal_id || '',
                company_id: data.company_id || '',
                customer_id: data.customer_id || '',
                supplier_id: data.supplier_id || '',
                party_name: data.party_name || '',
                party_doc: data.party_doc || '',
                value: data.value ? String(data.value) : '',
                currency: data.currency || 'BRL',
                effective_date: data.effective_date || '',
                expiration_date: data.expiration_date || '',
                auto_renew: data.auto_renew || false,
                renewal_months: data.renewal_months || 12,
                content: data.content || '',
                notes: data.notes || ''
            });
        }
        setLoading(false);
    };

    const generateContractNumber = async (): Promise<string> => {
        const { data } = await supabase.rpc('generate_contract_number');
        return data || `CNT-${Date.now()}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) { setError('Título é obrigatório.'); return; }
        setSaving(true);
        setError('');

        const { data: { user: authUser } } = await supabase.auth.getUser();

        const payload: any = {
            title: formData.title.trim(),
            type: formData.type,
            status: formData.status,
            crm_deal_id: formData.crm_deal_id || null,
            company_id: formData.company_id || null,
            customer_id: formData.customer_id || null,
            supplier_id: formData.supplier_id || null,
            party_name: formData.party_name || null,
            party_doc: formData.party_doc || null,
            value: formData.value ? parseFloat(formData.value) : 0,
            currency: formData.currency,
            effective_date: formData.effective_date || null,
            expiration_date: formData.expiration_date || null,
            auto_renew: formData.auto_renew,
            renewal_months: formData.renewal_months,
            content: formData.content || null,
            notes: formData.notes || null,
            owner_id: authUser?.id
        };

        let contractId = id;

        if (isEdit) {
            const { error: err } = await supabase.from('contracts').update(payload).eq('id', id!);
            if (err) { setError(err.message); setSaving(false); return; }
        } else {
            payload.contract_number = await generateContractNumber();
            const { data: inserted, error: err } = await supabase.from('contracts').insert([payload]).select('id').single();
            if (err || !inserted) { setError(err?.message || 'Erro ao criar contrato.'); setSaving(false); return; }
            contractId = inserted.id;

            // Log creation
            await supabase.from('contract_activities').insert([{
                contract_id: contractId,
                user_id: authUser?.id,
                action: 'created',
                description: 'Contrato criado.'
            }]);

            // Auto-create expiration alert if date set
            if (payload.expiration_date) {
                const triggerDate = new Date(payload.expiration_date);
                triggerDate.setDate(triggerDate.getDate() - 30);
                await supabase.from('contract_alerts').insert([{
                    contract_id: contractId,
                    type: 'expiration',
                    title: 'Contrato próximo ao vencimento',
                    message: `O contrato "${payload.title}" vence em 30 dias.`,
                    trigger_date: triggerDate.toISOString().split('T')[0]
                }]);
            }
        }

        setSaving(false);
        navigate(`/contratos/${contractId}`);
    };

    const set = (field: string, value: any) => setFormData(f => ({ ...f, [field]: value }));

    const inputCls = "w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none transition-all";
    const labelCls = "block text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-widest mb-1.5";

    if (loading) return (
        <div className="flex-1 flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
    );

    return (
        <div className="p-6 lg:p-10 max-w-4xl mx-auto">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-6 transition-colors font-bold">
                <ArrowLeft className="w-4 h-4" /> Voltar
            </button>

            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-8">
                {isEdit ? 'Editar Contrato' : 'Novo Contrato'}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Identificação */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-6 space-y-5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Identificação</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="md:col-span-2 space-y-1.5">
                            <label className={labelCls}>Título do Contrato *</label>
                            <input required value={formData.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Contrato de Serviços 2026" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Status</label>
                            <select
                                title="Selecionar status do contrato"
                                value={formData.status}
                                onChange={e => set('status', e.target.value)}
                                className={inputCls}
                            >
                                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Tipo de Contrato *</label>
                            <select
                                title="Selecionar tipo de contrato"
                                required
                                value={formData.type}
                                onChange={e => set('type', e.target.value)}
                                className={inputCls}
                            >
                                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Negócio CRM (opcional)</label>
                            <select
                                title="Vincular a um negócio do CRM"
                                value={formData.crm_deal_id}
                                onChange={e => set('crm_deal_id', e.target.value)}
                                className={inputCls}
                            >
                                <option value="">Selecionar negócio...</option>
                                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Parte Contratante */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-6 space-y-5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Parte Contratante</h2>
                    <p className="text-xs text-slate-400">Selecione uma empresa, cliente ou fornecedor cadastrado — ou preencha manualmente.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1.5">
                            <label className={labelCls}>Empresa (PJ)</label>
                            <select
                                title="Selecionar empresa contratante"
                                value={formData.company_id}
                                onChange={e => { set('company_id', e.target.value); if (e.target.value) { set('customer_id', ''); set('supplier_id', ''); } }}
                                className={inputCls}
                            >
                                <option value="">—</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Cliente (PF/PJ)</label>
                            <select
                                title="Selecionar cliente contratante"
                                value={formData.customer_id}
                                onChange={e => { set('customer_id', e.target.value); if (e.target.value) { set('company_id', ''); set('supplier_id', ''); } }}
                                className={inputCls}
                            >
                                <option value="">—</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Fornecedor</label>
                            <select
                                title="Selecionar fornecedor contratante"
                                value={formData.supplier_id}
                                onChange={e => { set('supplier_id', e.target.value); if (e.target.value) { set('company_id', ''); set('customer_id', ''); } }}
                                className={inputCls}
                            >
                                <option value="">—</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Nome livre (não cadastrado)</label>
                            <input value={formData.party_name} onChange={e => set('party_name', e.target.value)} placeholder="Razão social ou nome" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>CNPJ / CPF</label>
                            <input value={formData.party_doc} onChange={e => set('party_doc', e.target.value)} placeholder="00.000.000/0000-00" className={inputCls} />
                        </div>
                    </div>
                </div>

                {/* Financeiro e Vigência */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-6 space-y-5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Financeiro e Vigência</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <div className="col-span-2 md:col-span-1 space-y-1.5">
                            <label className={labelCls}>Valor (R$)</label>
                            <input type="number" min="0" step="0.01" value={formData.value} onChange={e => set('value', e.target.value)} placeholder="0,00" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Início de Vigência</label>
                            <input type="date" value={formData.effective_date} onChange={e => set('effective_date', e.target.value)} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Fim de Vigência</label>
                            <input type="date" value={formData.expiration_date} onChange={e => set('expiration_date', e.target.value)} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Renovação Automática</label>
                            <div className="flex items-center gap-3 h-11">
                                <input
                                    title="Ativar renovação automática"
                                    type="checkbox"
                                    id="auto_renew"
                                    checked={formData.auto_renew}
                                    onChange={e => set('auto_renew', e.target.checked)}
                                    className="w-5 h-5 accent-primary rounded"
                                />
                                <label htmlFor="auto_renew" className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-1.5 cursor-pointer">
                                    <RefreshCw className="w-4 h-4 text-primary" /> Sim
                                </label>
                            </div>
                        </div>
                        {formData.auto_renew && (
                            <div className="space-y-1.5">
                                <label className={labelCls}>Período (meses)</label>
                                <input
                                    title="Quantidade de meses para renovação"
                                    type="number"
                                    min="1"
                                    value={formData.renewal_months}
                                    onChange={e => set('renewal_months', parseInt(e.target.value))}
                                    className={inputCls}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-6 space-y-5">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Escopo e Cláusulas</h2>
                    <div className="space-y-1.5">
                        <label className={labelCls}>Conteúdo do Contrato</label>
                        <textarea
                            rows={10}
                            value={formData.content}
                            onChange={e => set('content', e.target.value)}
                            placeholder="Descreva o escopo, cláusulas, obrigações e demais condições do contrato..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelCls}>Observações Internas</label>
                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="Notas internas (não aparecem no documento final)..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                        />
                    </div>
                </div>

                {error && <p className="text-danger text-sm font-bold text-center">{error}</p>}

                {/* Actions */}
                <div className="flex justify-end gap-4 pb-10">
                    <button type="button" onClick={() => navigate(-1)} className="px-8 h-12 border border-slate-200 dark:border-surface-highlight text-slate-600 dark:text-text-secondary font-black rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-xs tracking-widest">
                        CANCELAR
                    </button>
                    <button disabled={saving} className="px-10 h-12 bg-primary text-background-dark font-black rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all flex items-center gap-2">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> {isEdit ? 'SALVAR ALTERAÇÕES' : 'CRIAR CONTRATO'}</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ContractForm;
