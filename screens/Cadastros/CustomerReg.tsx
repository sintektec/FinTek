
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
  Users,
  ShieldCheck,
  ShieldAlert,
  Building,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';

const CustomerReg: React.FC<{ user: User }> = ({ user }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingExternal, setLoadingExternal] = useState(false);
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
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setCustomers(data);
    }
    setLoading(false);
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
      setLoadingExternal(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanValue}`);
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            name: data.razao_social || prev.name,
            trade_name: data.nome_fantasia || prev.trade_name,
            email: data.email || prev.email,
            cep: data.cep ? formatCEP(data.cep) : prev.cep,
            logradouro: data.logradouro || prev.logradouro,
            numero: data.numero || prev.numero,
            complemento: data.complemento || prev.complemento,
            bairro: data.bairro || prev.bairro,
            cidade: data.municipio || prev.cidade,
            uf: data.uf || prev.uf
          }));
        }
      } finally {
        setLoadingExternal(false);
      }
    } else if (cleanValue.length === 11) {
      if (!validateCPF(cleanValue)) {
        setError('CPF Inválido');
      }
    }
  };

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatCEP(e.target.value);
    setFormData(prev => ({ ...prev, cep: value }));

    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length === 8) {
      setLoadingExternal(true);
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
      } finally {
        setLoadingExternal(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    setSaving(true);

    const payload = {
      ...formData,
      is_active: true
    };

    let result;
    if (editingId) {
      result = await supabase
        .from('customers')
        .update(payload)
        .eq('id', editingId);
    } else {
      result = await supabase
        .from('customers')
        .insert([payload]);
    }

    if (result.error) {
      alert('Erro ao salvar cliente: ' + result.error.message);
    } else {
      setShowForm(false);
      setEditingId(null);
      setFormData({
        cnpj_cpf: '', name: '', trade_name: '', email: '', phone: '',
        cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: ''
      });
      fetchCustomers();
    }
    setSaving(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      fetchCustomers();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja realmente EXCLUIR o cliente "${name}"?`)) {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao excluir: ' + error.message);
      } else {
        fetchCustomers();
      }
    }
  };

  const openEdit = (customer: any) => {
    setEditingId(customer.id);
    setFormData({
      cnpj_cpf: customer.cnpj_cpf || '',
      name: customer.name || '',
      trade_name: customer.trade_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      cep: customer.cep || '',
      logradouro: customer.logradouro || '',
      numero: customer.numero || '',
      complemento: customer.complemento || '',
      bairro: customer.bairro || '',
      cidade: customer.cidade || '',
      uf: customer.uf || ''
    });
    setShowForm(true);
  };

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cnpj_cpf?.includes(searchTerm)
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Clientes</h1>
          <p className="text-slate-600 dark:text-text-secondary text-base font-medium">Controle de carteira de clientes PJ e PF.</p>
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
            <Plus className="w-5 h-5" /> Novo Cliente
          </button>
        )}
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          placeholder="Buscar cliente por nome ou documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 pl-12 pr-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
        />
      </div>

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-surface-highlight/30 border-b border-slate-100 dark:border-surface-highlight">
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Cliente</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Documento</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Cidade/UF</th>
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
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Nenhum cliente encontrado.</td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Building className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">{c.name}</span>
                          {c.trade_name && (
                            <span className="text-[10px] text-primary font-black uppercase tracking-wider">{c.trade_name}</span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium">{c.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-medium text-slate-600 dark:text-text-secondary">{c.cnpj_cpf || '-'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-medium text-slate-600 dark:text-text-secondary">{c.cidade ? `${c.cidade} / ${c.uf}` : '-'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        onClick={() => (user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && handleToggleActive(c.id, c.is_active)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${c.is_active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-danger/10 text-danger hover:bg-danger/20'}`}
                        disabled={user.role !== 'MASTER_ADMIN' && user.role !== 'ADMIN'}
                      >
                        {c.is_active ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {c.is_active ? 'Ativo' : 'Bloqueado'}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl p-8 shadow-2xl w-full max-w-2xl my-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-surface-highlight pb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingId ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-danger transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2 relative text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CNPJ / CPF</label>
                  <input
                    required
                    value={formData.cnpj_cpf}
                    onChange={handleDocChange}
                    className={`h-12 w-full rounded-xl border ${error ? 'border-danger' : 'border-slate-200 dark:border-surface-highlight'} bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all`}
                    placeholder="00.000.000/0000-00"
                  />
                  {loadingExternal && <div className="absolute right-3 top-9 size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
                  {error && <p className="text-[10px] text-danger font-black uppercase tracking-wider mt-1">{error}</p>}
                </div>
                <div className="md:col-span-2 space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Razão Social (Nome Oficial)</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Razão Social"
                  />
                </div>
                <div className="md:col-span-2 space-y-2 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome Fantasia</label>
                  <input
                    value={formData.trade_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, trade_name: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Nome comercial da marca"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Telefone</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="contato@cliente.com"
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

export default CustomerReg;
