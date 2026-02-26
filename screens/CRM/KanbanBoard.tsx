import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, MoreVertical, Building2, User2, AlignLeft, CalendarDays } from 'lucide-react';
import DealModal from './DealModal';

interface Stage {
    id: string;
    name: string;
    order_index: number;
    color: string;
}

interface Deal {
    id: string;
    title: string;
    value: number;
    stage_id: string;
    expected_close_date: string;
    company?: { name: string } | null;
    customer?: { name: string } | null;
    workflow_status?: 'pending' | 'approved' | 'rejected' | 'proposal_sent';
}

const KanbanBoard = () => {
    const [stages, setStages] = useState<Stage[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
    const [selectedStageId, setSelectedStageId] = useState<string | undefined>();

    useEffect(() => {
        fetchBoardData();
    }, []);

    const fetchBoardData = async () => {
        setLoading(true);
        try {
            const [stagesRes, dealsRes] = await Promise.all([
                supabase.from('crm_stages').select('*').order('order_index'),
                supabase.from('crm_deals').select(`
          *,
          company:companies(name),
          customer:customers(name)
        `)
            ]);

            if (stagesRes.data) setStages(stagesRes.data);
            if (dealsRes.data) setDeals(dealsRes.data as Deal[]);
        } catch (error) {
            console.error('Error fetching board data:', error);
        } finally {
            setLoading(false);
        }
    };

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const deal = deals.find((d: Deal) => d.id === draggableId);
        if (!deal) return;

        // Optimistic UI update
        const newDeals = Array.from(deals);
        const dealIndex = newDeals.findIndex((d: Deal) => d.id === draggableId);
        newDeals[dealIndex] = { ...deal, stage_id: destination.droppableId };
        setDeals(newDeals);

        // Persist change
        const { error } = await supabase
            .from('crm_deals')
            .update({ stage_id: destination.droppableId, updated_at: new Date().toISOString() })
            .eq('id', draggableId);

        if (error) {
            console.error('Error moving deal:', error);
            fetchBoardData(); // Revert on error
        }
    };

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    if (loading) {
        return (
            <div className="flex-1 flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-background-dark">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-surface-highlight bg-white dark:bg-surface-dark shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">CRM Pipeline</h1>
                    <p className="text-sm font-semibold text-slate-500 dark:text-text-secondary mt-1">Gerencie suas oportunidades de vendas</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedDealId(null);
                        setSelectedStageId(stages.length > 0 ? stages[0].id : undefined);
                        setModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
                >
                    <Plus className="w-5 h-5" />
                    Novo Negócio
                </button>
            </div>

            {/* Kanban Scroll Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex gap-6 h-full min-w-max pb-4">
                        {stages.map((stage) => {
                            const stageDeals = deals.filter(d => d.stage_id === stage.id);
                            const stageTotal = stageDeals.reduce((acc, deal) => acc + Number(deal.value || 0), 0);

                            return (
                                <div key={stage.id} className="flex flex-col w-[320px] shrink-0">
                                    {/* Stage Header */}
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: stage.color }}></div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">{stage.name}</h3>
                                            <span className="bg-slate-200 dark:bg-surface-highlight text-slate-600 dark:text-text-secondary text-xs font-black px-2 py-0.5 rounded-full">
                                                {stageDeals.length}
                                            </span>
                                        </div>
                                        <span className="text-sm font-black text-slate-400 dark:text-text-secondary">
                                            {formatBRL(stageTotal)}
                                        </span>
                                    </div>

                                    {/* Droppable Area */}
                                    <Droppable droppableId={stage.id}>
                                        {(provided, snapshot) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`flex-1 flex flex-col gap-3 p-2 rounded-2xl transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5 border-2 border-dashed border-primary/30' : 'bg-slate-100/50 dark:bg-surface-dark/50'
                                                    }`}
                                            >
                                                {stageDeals.map((deal, index) => {
                                                    return (
                                                        // @ts-ignore - Prop 'key' is required by React but missing in DraggableProps types
                                                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    className={`bg-white dark:bg-surface-highlight p-4 rounded-xl shadow-sm cursor-pointer border border-slate-200 dark:border-surface-highlight/50 transition-all ${snapshot.isDragging ? 'shadow-xl rotate-2 scale-105 z-50 ring-2 ring-primary' : 'hover:shadow-md hover:-translate-y-0.5'
                                                                        }`}
                                                                    onClick={() => {
                                                                        setSelectedDealId(deal.id);
                                                                        setModalOpen(true);
                                                                    }}
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                                                            {deal.title}
                                                                        </h4>
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <button
                                                                                title="Ações do negócio"
                                                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white opacity-0 group-hover:opacity-100"
                                                                            >
                                                                                <MoreVertical className="w-4 h-4" />
                                                                            </button>
                                                                            {deal.workflow_status === 'rejected' && (
                                                                                <span className="bg-danger/10 text-danger text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">REPROVADO</span>
                                                                            )}
                                                                            {deal.workflow_status === 'approved' && (
                                                                                <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">APROVADO</span>
                                                                            )}
                                                                            {deal.workflow_status === 'proposal_sent' && (
                                                                                <span className="bg-blue-500/10 text-blue-600 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">ENVIADA</span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="font-black text-primary mb-3">
                                                                        {formatBRL(deal.value)}
                                                                    </div>

                                                                    <div className="flex flex-col gap-1.5 mt-auto">
                                                                        {(deal.company || deal.customer) && (
                                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-text-secondary font-semibold">
                                                                                {deal.company ? <Building2 className="w-3.5 h-3.5" /> : <User2 className="w-3.5 h-3.5" />}
                                                                                <span className="truncate">{deal.company?.name || deal.customer?.name}</span>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-text-secondary mt-1">
                                                                            <div className="flex items-center gap-1">
                                                                                <AlignLeft className="w-3.5 h-3.5" />
                                                                            </div>
                                                                            {deal.expected_close_date && (
                                                                                <div className={`flex items-center gap-1 font-bold ${new Date(deal.expected_close_date) < new Date() ? 'text-danger' : ''
                                                                                    }`}>
                                                                                    <CalendarDays className="w-3.5 h-3.5" />
                                                                                    <span>{formatDate(deal.expected_close_date)}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    );
                                                })}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </div>
                </DragDropContext>
            </div >

            <DealModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                dealId={selectedDealId}
                stageId={selectedStageId}
                onSave={() => {
                    setModalOpen(false);
                    fetchBoardData(); // Refresh UI after creation/edit
                }}
            />
        </div >
    );
};

export default KanbanBoard;
