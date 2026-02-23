
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { validateCNPJ, formatDocument, validateCPF, formatCEP } from '../../utils/helpers';
import { User, Company } from '../../types';
import { supabase } from '../../lib/supabase';
import { Edit3, Trash2, PlusCircle, Building2, Search, X, Users, UserPlus, Trash, MapPin } from 'lucide-react';

const CompanyReg: React.FC<{ user: User }> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: ''
  });

  const [partners, setPartners] = useState<{ name: string; cpf: string; participation: string }[]>([]);
  const [newPartner, setNewPartner] = useState({ name: '', cpf: '', participation: '' });
  const [editingPartnerIdx, setEditingPartnerIdx] = useState<number | null>(null);
  const [showPartnerForm, setShowPartnerForm] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching companies:', error);
    } else {
      setCompanies(data || []);
    }
    setFetching(false);
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

  const handleCNPJChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatDocument(e.target.value);
    setFormData(prev => ({ ...prev, cnpj: value }));
    setError('');

    const cleanValue = value.replace(/\D/g, '');

    // CNPJ logic
    if (cleanValue.length === 14) {
      if (!validateCNPJ(cleanValue)) {
        setError('CNPJ Inválido');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanValue}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          razaoSocial: data.razao_social || '',
          nomeFantasia: data.nome_fantasia || data.razao_social || '',
          email: data.email || '',
          cep: data.cep ? (data.cep.includes('-') ? data.cep : formatCEP(data.cep)) : prev.cep,
          logradouro: data.logradouro || prev.logradouro,
          numero: data.numero || prev.numero,
          complemento: data.complemento || prev.complemento,
          bairro: data.bairro || prev.bairro,
          cidade: data.municipio || prev.cidade,
          uf: data.uf || prev.uf
        }));
      } catch (err) {
        setError('Não foi possível buscar os dados do CNPJ');
      } finally {
        setLoading(false);
      }
    }
    // CPF logic - just validation
    else if (cleanValue.length === 11) {
      if (!validateCPF(cleanValue)) {
        setError('CPF Inválido');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      cnpj: formData.cnpj,
      razao_social: formData.razaoSocial,
      name: formData.nomeFantasia,
      email: formData.email,
      cep: formData.cep,
      logradouro: formData.logradouro,
      numero: formData.numero,
      complemento: formData.complemento,
      bairro: formData.bairro,
      cidade: formData.cidade,
      uf: formData.uf
    };

    let companyId = editingId;
    let result;

    if (editingId) {
      result = await supabase
        .from('companies')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
    } else {
      result = await supabase
        .from('companies')
        .insert([payload])
        .select()
        .single();
    }

    if (result.error) {
      alert('Erro ao salvar empresa: ' + result.error.message);
      setSaving(false);
      return;
    }

    companyId = result.data.id;

    // Handle Partners
    if (companyId) {
      // For simplicity in this demo/MVP, we delete all existing partners and re-insert
      // In a production app with IDs, we would do a more precise sync
      if (editingId) {
        await supabase.from('company_partners').delete().eq('company_id', companyId);
      }

      if (partners.length > 0) {
        const partnersPayload = partners.map(p => ({
          company_id: companyId,
          name: p.name,
          cpf: p.cpf,
          participation_percentage: parseFloat(p.participation)
        }));

        const { error: partnersError } = await supabase
          .from('company_partners')
          .insert(partnersPayload);

        if (partnersError) {
          console.error('Error saving partners:', partnersError);
          alert('Empresa salva, mas houve erro ao salvar sócios: ' + partnersError.message);
        }
      }
    }

    resetForm();
    fetchCompanies();
    setSaving(false);
  };

  const savePartner = () => {
    if (!newPartner.name || !newPartner.cpf || !newPartner.participation) {
      alert('Preencha os dados do sócio');
      return;
    }

    const cleanDoc = newPartner.cpf.replace(/\D/g, '');
    let isValid = false;
    if (cleanDoc.length === 11) {
      isValid = validateCPF(cleanDoc);
    } else if (cleanDoc.length === 14) {
      isValid = validateCNPJ(cleanDoc);
    }

    if (!isValid) {
      alert('CPF ou CNPJ do sócio é inválido. Verifique os dados e tente novamente.');
      return;
    }

    if (editingPartnerIdx !== null) {
      const updatedPartners = [...partners];
      updatedPartners[editingPartnerIdx] = { ...newPartner };
      setPartners(updatedPartners);
      setEditingPartnerIdx(null);
      setShowPartnerForm(false);
    } else {
      setPartners([...partners, { ...newPartner }]);
      setShowPartnerForm(false);
    }

    setNewPartner({ name: '', cpf: '', participation: '' });
  };

  const removePartner = (index: number) => {
    if (confirm('Deseja excluir este sócio?')) {
      setPartners(partners.filter((_, i) => i !== index));
      if (editingPartnerIdx === index) {
        setEditingPartnerIdx(null);
        setNewPartner({ name: '', cpf: '', participation: '' });
      }
    }
  };

  const editPartner = (index: number) => {
    const partner = partners[index];
    setNewPartner({ ...partner });
    setEditingPartnerIdx(index);
    setShowPartnerForm(true);
    // Scroll to partner form
    const partnerForm = document.getElementById('partner-form');
    if (partnerForm) {
      partnerForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleEdit = async (company: Company) => {
    setFormData({
      cnpj: company.cnpj || '',
      razaoSocial: company.razao_social || '',
      nomeFantasia: company.name || '',
      email: company.email || '',
      cep: company.cep || '',
      logradouro: company.logradouro || '',
      numero: company.numero || '',
      complemento: company.complemento || '',
      bairro: company.bairro || '',
      cidade: company.cidade || '',
      uf: company.uf || ''
    });
    setEditingId(company.id);
    setShowForm(true);
    setShowPartnerForm(false);
    setEditingPartnerIdx(null);

    // Fetch Partners
    const { data: partnersData, error: partnersError } = await supabase
      .from('company_partners')
      .select('*')
      .eq('company_id', company.id);

    if (!partnersError && partnersData) {
      setPartners(partnersData.map(p => ({
        name: p.name,
        cpf: p.cpf,
        participation: p.participation_percentage.toString()
      })));
    } else {
      setPartners([]);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja realmente excluir a empresa "${name}"? Esta ação não pode ser desfeita.`)) {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao excluir empresa: ' + error.message);
      } else {
        fetchCompanies();
      }
    }
  };

  const resetForm = () => {
    setFormData({
      cnpj: '', razaoSocial: '', nomeFantasia: '', email: '',
      cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: ''
    });
    setPartners([]);
    setNewPartner({ name: '', cpf: '', participation: '' });
    setEditingId(null);
    setEditingPartnerIdx(null);
    setShowPartnerForm(false);
    setShowForm(false);
    setError('');
  };

  const filteredCompanies = companies.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cnpj?.includes(searchTerm) ||
    c.razao_social?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
            <span className="text-slate-300 dark:text-surface-highlight">/</span>
            <span className="text-primary font-bold">Empresas</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Gestão de Empresas</h1>
          <p className="text-slate-600 dark:text-text-secondary text-base">Visualize e gerencie as empresas cadastradas no sistema.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar empresa..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 h-12 rounded-xl border border-slate-200 dark:border-surface-highlight bg-white dark:bg-surface-dark text-slate-900 dark:text-white text-sm font-bold w-64 focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
            <button
              onClick={() => {
                if (showForm && !editingId) setShowForm(false);
                else {
                  resetForm();
                  setShowForm(true);
                }
              }}
              className={`flex items-center gap-2 px-6 h-12 rounded-xl transition-all font-black text-sm shadow-lg ${showForm && !editingId ? 'bg-slate-200 dark:bg-surface-highlight text-slate-900 dark:text-white' : 'bg-primary text-background-dark shadow-primary/20 hover:bg-primary-hover'}`}
            >
              {showForm && !editingId ? <><X className="w-4 h-4" /> Cancelar</> : <><PlusCircle className="w-4 h-4" /> Adicionar Empresa</>}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-surface-highlight pb-6">
            <Building2 className="text-primary w-8 h-8" />
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {editingId ? 'Editar Empresa' : 'Novo Cadastro de Empresa'}
            </h3>
          </div>

          <form onSubmit={handleSave} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-12 space-y-2 relative">
                <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">CPF / CNPJ</label>
                <div className="relative">
                  <input
                    required
                    value={formData.cnpj}
                    onChange={handleCNPJChange}
                    className={`h-12 w-full rounded-xl border ${error ? 'border-danger' : 'border-slate-200 dark:border-surface-highlight'} bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary font-bold`}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  />
                  {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {error && <p className="text-[10px] text-danger font-black uppercase tracking-wider">{error}</p>}
              </div>
              <div className="md:col-span-8 space-y-2">
                <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">Razão Social</label>
                <input
                  required
                  value={formData.razaoSocial}
                  onChange={(e) => setFormData(prev => ({ ...prev, razaoSocial: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold"
                  placeholder="Razão Social da Empresa"
                />
              </div>
              <div className="md:col-span-6 space-y-2">
                <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">Nome Fantasia</label>
                <input
                  required
                  value={formData.nomeFantasia}
                  onChange={(e) => setFormData(prev => ({ ...prev, nomeFantasia: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold"
                  placeholder="Nome comercial"
                />
              </div>
              <div className="md:col-span-6 space-y-2">
                <label className="text-xs font-black text-slate-600 dark:text-text-secondary uppercase tracking-widest">Email Corporativo</label>
                <input
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold"
                  type="email"
                  placeholder="contato@empresa.com.br"
                />
              </div>

              <div className="md:col-span-12 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="text-primary w-4 h-4" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereço de Faturamento</span>
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

              {/* Partners Section */}
              <div className="md:col-span-12 space-y-6 pt-6 border-t border-slate-100 dark:border-surface-highlight">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="text-primary w-5 h-5" />
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Sócios</h4>
                  </div>
                  {!showPartnerForm && (
                    <button
                      type="button"
                      onClick={() => setShowPartnerForm(true)}
                      className="flex items-center gap-2 px-4 h-9 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                    >
                      <UserPlus className="w-4 h-4" /> Adicionar Sócio
                    </button>
                  )}
                </div>

                {(showPartnerForm || editingPartnerIdx !== null) && (
                  <div id="partner-form" className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-6 rounded-2xl border transition-all duration-300 ${editingPartnerIdx !== null ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-slate-50 dark:bg-surface-darker/50 border-slate-100 dark:border-surface-highlight/30'}`}>
                    <div className="md:col-span-4 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome do Sócio</label>
                      <input
                        value={newPartner.name}
                        onChange={e => setNewPartner({ ...newPartner, name: e.target.value })}
                        className="h-10 w-full rounded-lg border border-slate-200 dark:border-surface-highlight bg-white dark:bg-surface-dark px-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold"
                        placeholder="Ex: Carlos Alberto"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF / CNPJ</label>
                      <input
                        required
                        value={newPartner.cpf}
                        onChange={e => setNewPartner({ ...newPartner, cpf: formatDocument(e.target.value) })}
                        className="h-10 w-full rounded-lg border border-slate-200 dark:border-surface-highlight bg-white dark:bg-surface-dark px-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Participação %</label>
                      <input
                        type="number"
                        value={newPartner.participation}
                        onChange={e => setNewPartner({ ...newPartner, participation: e.target.value })}
                        className="h-10 w-full rounded-lg border border-slate-200 dark:border-surface-highlight bg-white dark:bg-surface-dark px-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold text-right"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={savePartner}
                          className={`flex-1 h-10 rounded-lg flex items-center justify-center gap-2 text-xs font-black transition-all uppercase tracking-widest ${editingPartnerIdx !== null ? 'bg-primary text-background-dark shadow-lg shadow-primary/20 hover:bg-primary-hover' : 'bg-surface-highlight text-white hover:bg-slate-600'}`}
                        >
                          {editingPartnerIdx !== null ? <><Edit3 className="w-4 h-4" /> Salvar</> : <><UserPlus className="w-4 h-4" /> Add</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPartnerIdx(null);
                            setShowPartnerForm(false);
                            setNewPartner({ name: '', cpf: '', participation: '' });
                          }}
                          className="px-3 h-10 rounded-lg bg-slate-200 dark:bg-surface-highlight text-slate-600 dark:text-white font-black hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {partners.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-surface-highlight bg-white dark:bg-surface-dark">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-surface-highlight/30 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-5 py-3 text-left">Nome</th>
                          <th className="px-5 py-3 text-left">CPF</th>
                          <th className="px-5 py-3 text-right">%</th>
                          <th className="px-5 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight">
                        {partners.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-surface-highlight/10 transition-colors">
                            <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                            <td className="px-5 py-3 font-medium text-slate-600 dark:text-text-secondary">{p.cpf}</td>
                            <td className="px-5 py-3 font-black text-slate-900 dark:text-white text-right">{p.participation}%</td>
                            <td className="px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => editPartner(idx)}
                                  className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                  title="Editar Sócio"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removePartner(idx)}
                                  className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                  title="Excluir Sócio"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-slate-100 dark:border-surface-highlight">
              <button
                type="button"
                onClick={resetForm}
                className="px-8 h-12 rounded-xl border border-slate-200 dark:border-surface-highlight text-slate-900 dark:text-white font-black hover:bg-slate-50 dark:hover:bg-white/5 transition-all uppercase tracking-widest text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-10 h-12 rounded-xl bg-primary text-background-dark font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {saving ? (
                  <div className="size-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <><PlusCircle className="w-4 h-4" /> {editingId ? 'Salvar Alterações' : 'Cadastrar Empresa'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {fetching ? (
            <div className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Carregando empresas...</div>
          ) : filteredCompanies.length === 0 ? (
            <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">Nenhuma empresa encontrada.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-surface-highlight/30 text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-text-secondary border-b border-slate-200 dark:border-surface-highlight">
                  <th className="px-8 py-5">Nome Fantasia / Razão Social</th>
                  <th className="px-8 py-5">CNPJ</th>
                  <th className="px-8 py-5">E-mail</th>
                  {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && <th className="px-8 py-5 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-surface-highlight/10 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 dark:text-white text-sm">{company.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-text-secondary uppercase tracking-wider line-clamp-1">{company.razao_social}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{company.cnpj}</td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600 dark:text-slate-300">{company.email}</td>
                    {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
                      <td className="px-8 py-5">
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleEdit(company)}
                            className="p-2.5 hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 rounded-xl transition-all"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(company.id, company.name)}
                            className="p-2.5 hover:bg-danger/10 text-slate-400 hover:text-danger rounded-xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyReg;
