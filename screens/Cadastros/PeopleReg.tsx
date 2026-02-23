
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { validateCPF, formatCPF, formatPhone, formatCEP } from '../../utils/helpers';
import { User } from '../../types';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Loader2,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Phone,
  Calendar,
  MapPin
} from 'lucide-react';

const PeopleReg: React.FC<{ user: User }> = ({ user }) => {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    cpf: '',
    email: '',
    phone: '',
    birth_date: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: ''
  });

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setPeople(data);
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

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatCPF(e.target.value);
    setFormData(prev => ({ ...prev, cpf: value }));
    setError('');

    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length === 11) {
      if (!validateCPF(cleanValue)) {
        setError('CPF Inválido');
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
        .from('people')
        .update(payload)
        .eq('id', editingId);
    } else {
      result = await supabase
        .from('people')
        .insert([payload]);
    }

    if (result.error) {
      alert('Erro ao salvar: ' + result.error.message);
    } else {
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '', nickname: '', cpf: '', email: '', phone: '', birth_date: '',
        cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: ''
      });
      fetchPeople();
    }
    setSaving(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('people')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      fetchPeople();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja realmente EXCLUIR o registro de "${name}"?`)) {
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao excluir: ' + error.message);
      } else {
        fetchPeople();
      }
    }
  };

  const openEdit = (person: any) => {
    setEditingId(person.id);
    setFormData({
      email: person.email || '',
      phone: person.phone || '',
      birth_date: person.birth_date || '',
      cep: person.cep || '',
      logradouro: person.logradouro || '',
      numero: person.numero || '',
      complemento: person.complemento || '',
      bairro: person.bairro || '',
      cidade: person.cidade || '',
      uf: person.uf || ''
    });
    setShowForm(true);
  };

  const filteredPeople = people.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf?.includes(searchTerm)
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Pessoas</h1>
          <p className="text-slate-600 dark:text-text-secondary text-base font-medium">Gestão de cadastros de pessoas físicas.</p>
        </div>
        {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                name: '', nickname: '', cpf: '', email: '', phone: '', birth_date: '',
                cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: ''
              });
              setShowForm(true);
            }}
            className="px-8 h-12 rounded-xl bg-primary text-background-dark font-black shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-5 h-5" /> Nova Pessoa
          </button>
        )}
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
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
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Nome</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">CPF</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Contatos</th>
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
              ) : filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                filteredPeople.map((p) => (
                  <tr key={p.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                            {p.nickname && (
                              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
                                {p.nickname}
                              </span>
                            )}
                          </div>
                          {p.birth_date && (
                            <span className="text-[10px] text-slate-400 font-medium">Nasc: {new Date(p.birth_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-medium text-slate-600 dark:text-text-secondary">{p.cpf || '-'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        {p.email && <span className="text-xs text-slate-500">{p.email}</span>}
                        {p.phone && <span className="text-xs text-slate-500">{p.phone}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        onClick={() => (user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && handleToggleActive(p.id, p.is_active)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${p.is_active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-danger/10 text-danger hover:bg-danger/20'}`}
                        disabled={user.role !== 'MASTER_ADMIN' && user.role !== 'ADMIN'}
                      >
                        {p.is_active ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {p.is_active ? 'Ativo' : 'Bloqueado'}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
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
            <div className="flex justify-between items-center mb-10 border-b border-slate-100 dark:border-surface-highlight pb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingId ? 'Editar Pessoa' : 'Novo Registro'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-danger transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF</label>
                  <input
                    required
                    value={formData.cpf}
                    onChange={handleCPFChange}
                    className={`h-12 w-full rounded-xl border ${error ? 'border-danger' : 'border-slate-200 dark:border-surface-highlight'} bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all`}
                    placeholder="000.000.000-00"
                  />
                  {error && <p className="text-[10px] text-danger font-black uppercase tracking-wider mt-1">{error}</p>}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome Completo</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Apelido</label>
                  <input
                    value={formData.nickname}
                    onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Como a pessoa é conhecida"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data de Nascimento</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                      className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker pl-12 pr-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="joao@email.com"
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
                    <div className="md:col-span-12 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Complemento</label>
                      <input
                        value={formData.complemento}
                        onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                        placeholder="Apto, Bloco, Sala..."
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

export default PeopleReg;
