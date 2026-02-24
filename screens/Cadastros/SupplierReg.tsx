
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { validateCNPJ, formatCNPJ, validateCPF, formatCPF, formatDocument, formatCEP, formatPhone } from '../../utils/helpers';
import { User } from '../../types';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';

const SupplierReg: React.FC<{ user: User }> = ({ user }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    cnpj_cpf: '',
    name: '',
    trade_name: '',
    email: '',
    phone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setSuppliers(data);
    }
    setLoading(false);
  };

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatCEP(e.target.value);
    setFormData(prev => ({ ...prev, cep: value }));

    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanValue}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            complemento: data.complemento || prev.complemento,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            uf: data.uf || prev.uf
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      }
    }
  };

  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatDocument(e.target.value);
    setFormData(prev => ({ ...prev, cnpj_cpf: value }));
    setError('');

    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length === 14) {
      if (!validateCNPJ(cleanValue)) {
        setError('CNPJ Inválido');
        return;
      }
      // Auto-fetch CNPJ data
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanValue}`);
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            name: data.razao_social || prev.name,
            trade_name: data.nome_fantasia || prev.trade_name,
            email: data.email || prev.email,
            cep: data.cep ? (data.cep.includes('-') ? data.cep : formatCEP(data.cep)) : prev.cep,
            logradouro: data.logradouro || prev.logradouro,
            numero: data.numero || prev.numero,
            complemento: data.complemento || prev.complemento,
            bairro: data.bairro || prev.bairro,
            cidade: data.municipio || prev.cidade,
            uf: data.uf || prev.uf
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar CNPJ:', err);
      }
    } else if (cleanValue.length === 11) {
      if (!validateCPF(cleanValue)) {
        setError('CPF Inválido');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    setSaving(true);

    const payload: any = {
      name: formData.name,
      trade_name: formData.trade_name,
      cnpj_cpf: formData.cnpj_cpf,
      email: formData.email,
      phone: formData.phone,
      cep: formData.cep,
      logradouro: formData.logradouro,
      numero: formData.numero,
      complemento: formData.complemento,
      bairro: formData.bairro,
      cidade: formData.cidade,
      uf: formData.uf,
      is_active: true
    };

    if (payload.numero === '') delete payload.numero;
    if (payload.complemento === '') delete payload.complemento;

    let result;
    if (editingId) {
      result = await supabase
        .from('suppliers')
        .update(payload)
        .eq('id', editingId);
    } else {
      result = await supabase
        .from('suppliers')
        .insert([payload]);
    }

    if (result.error) {
      alert('Erro ao salvar fornecedor: ' + result.error.message);
    } else {
      setShowForm(false);
      setEditingId(null);
      setFormData({
        cnpj_cpf: '', name: '', trade_name: '', email: '', phone: '',
        cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: ''
      });
      fetchSuppliers();
    }
    setSaving(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      fetchSuppliers();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja realmente EXCLUIR o fornecedor "${name}"?`)) {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao excluir: ' + error.message);
      } else {
        fetchSuppliers();
      }
    }
  };

  const openEdit = (supplier: any) => {
    setEditingId(supplier.id);
    setFormData({
      cnpj_cpf: supplier.cnpj_cpf || '',
      name: supplier.name || '',
      trade_name: supplier.trade_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      cep: supplier.cep || '',
      logradouro: supplier.logradouro || '',
      numero: supplier.numero || '',
      complemento: supplier.complemento || '',
      bairro: supplier.bairro || '',
      cidade: supplier.cidade || '',
      uf: supplier.uf || ''
    });
    setShowForm(true);
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.trade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cnpj_cpf?.includes(searchTerm)
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Fornecedores</h1>
          <p className="text-slate-600 dark:text-text-secondary text-base font-medium">Gerencie seus parceiros e fornecedores comerciais.</p>
        </div>
        {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                cnpj_cpf: '', name: '', trade_name: '', email: '', phone: '',
                cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: ''
              });
              setShowForm(true);
            }}
            className="px-8 h-12 rounded-xl bg-primary text-background-dark font-black shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-5 h-5" /> Novo Fornecedor
          </button>
        )}
      </div>

      {/* Search & Stats Placeholder */}
      <div className="relative group max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          placeholder="Buscar fornecedor por nome ou documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 pl-12 pr-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
        />
      </div>

      {/* List Table */}
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-surface-highlight/30 border-b border-slate-100 dark:border-surface-highlight">
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Fornecedor</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Documento</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Contato</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em] text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Nenhum fornecedor encontrado.</td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr key={s.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white capitalize">{s.trade_name || s.name}</span>
                          {s.trade_name && <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">{s.name}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-medium text-slate-600 dark:text-text-secondary">{s.cnpj_cpf || '-'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        {s.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-text-secondary">
                            <Mail className="w-3 h-3" /> {s.email}
                          </div>
                        )}
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-text-secondary">
                            <Phone className="w-3 h-3" /> {s.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        onClick={() => (user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && handleToggleActive(s.id, s.is_active)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${s.is_active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-danger/10 text-danger hover:bg-danger/20'}`}
                        disabled={user.role !== 'MASTER_ADMIN' && user.role !== 'ADMIN'}
                      >
                        {s.is_active ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {s.is_active ? 'Ativo' : 'Bloqueado'}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl p-8 shadow-2xl w-full max-w-2xl my-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-10 border-b border-slate-100 dark:border-surface-highlight pb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-danger transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">CNPJ / CPF</label>
                  <input
                    required
                    value={formData.cnpj_cpf}
                    onChange={handleDocChange}
                    className={`h-12 w-full rounded-xl border ${error ? 'border-danger' : 'border-slate-200 dark:border-surface-highlight'} bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all`}
                    placeholder="00.000.000/0000-00"
                  />
                  {error && <p className="text-[10px] text-danger font-black uppercase tracking-wider">{error}</p>}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">Razão Social / Nome</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Ex: Fornecedor de Serviços Ltda"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">Nome Fantasia</label>
                  <input
                    value={formData.trade_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, trade_name: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Ex: Apelido Comercial"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">Telefone</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="contato@fornecedor.com.br"
                  />
                </div>

                <div className="md:col-span-2 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="text-primary w-4 h-4" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereço</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 space-y-2 relative">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CEP</label>
                      <input
                        value={formData.cep}
                        onChange={handleCEPChange}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="md:col-span-9 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logradouro</label>
                      <input
                        value={formData.logradouro}
                        onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                        placeholder="Rua, Av..."
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Número</label>
                      <input
                        value={formData.numero}
                        onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                        placeholder="123"
                      />
                    </div>
                    <div className="md:col-span-12 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Complemento</label>
                      <input
                        value={formData.complemento}
                        onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                        placeholder="Apto, Bloco, Sala..."
                      />
                    </div>
                    <div className="md:col-span-5 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bairro</label>
                      <input
                        value={formData.bairro}
                        onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                        placeholder="Bairro"
                      />
                    </div>
                    <div className="md:col-span-5 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cidade</label>
                      <input
                        value={formData.cidade}
                        onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                        placeholder="Cidade"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">UF</label>
                      <input
                        value={formData.uf}
                        onChange={(e) => setFormData(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))}
                        maxLength={2}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold text-center"
                        placeholder="SP"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-slate-100 dark:border-surface-highlight">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 h-12 border border-slate-200 dark:border-surface-highlight text-slate-600 dark:text-text-secondary font-black rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-xs tracking-widest"
                >
                  CANCELAR
                </button>
                <button
                  disabled={saving}
                  className="px-10 h-12 bg-primary text-background-dark font-black rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SALVAR REGISTRO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierReg;
