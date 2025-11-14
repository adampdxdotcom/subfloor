// pages/ProjectDetail.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Project, ProjectStatus, Quote, QuoteStatus, ChangeOrder, MaterialOrder } from '../types';
import { Layers, FileText, PlusCircle, Package as PackageIcon, Trash2, History } from 'lucide-react';
import CollapsibleSection from '../components/CollapsibleSection';
import EditProjectModal from '../components/EditProjectModal';
import EditChangeOrderModal from '../components/EditChangeOrderModal';
import ProjectInfoHeader from '../components/ProjectInfoHeader';
import SampleCheckoutsSection from '../components/SampleCheckoutsSection';
import QuotesSection from '../components/QuotesSection';
import FinalizeJobSection from '../components/FinalizeJobSection';
import ChangeOrderSection from '../components/ChangeOrderSection';
import MaterialOrdersSection from '../components/MaterialOrdersSection';
import ActivityHistory from '../components/ActivityHistory';
import { toast } from 'react-hot-toast';

const ProjectDetail: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate(); 
    
    // vvvvvvvvvvvv MODIFIED: Destructured currentUser for RBAC check vvvvvvvvvvvv
    const { 
        currentUser,
        projects, customers, samples, sampleCheckouts, quotes, jobs, installers, changeOrders, materialOrders,
        addSample, updateProject, deleteProject, addSampleCheckout, updateSampleCheckout, addQuote, updateQuote, 
        saveJobDetails, addInstaller, addChangeOrder, updateChangeOrder, addMaterialOrder, updateMaterialOrder,
        extendSampleCheckout,
        projectHistory,
        fetchProjectHistory
    } = useData();
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    
    const [activeModal, setActiveModal] = useState<'sample' | 'quote' | 'order' | null>(null);
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [editingQuoteForModal, setEditingQuoteForModal] = useState<Quote | null>(null);
    const [editingOrder, setEditingOrder] = useState<MaterialOrder | null>(null);
    const [editingChangeOrder, setEditingChangeOrder] = useState<ChangeOrder | null>(null);

    const [localProject, setLocalProject] = useState<Project | null | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const { isLoading: isDataLoading } = useData();
    
    useEffect(() => {
        const id = parseInt(projectId || '');
        if (isNaN(id)) {
            setIsLoading(false);
            setLocalProject(null);
            return;
        }

        if (!isDataLoading) {
            const projectFromState = projects.find(p => p.id === id);
            setLocalProject(projectFromState || null);
            setIsLoading(false);
            fetchProjectHistory(id);
        }
    }, [projectId, projects, isDataLoading, fetchProjectHistory]);

    const handleOpenEditChangeOrderModal = (changeOrder: ChangeOrder) => {
        setEditingChangeOrder(changeOrder);
    };

    const customer = customers.find(c => c.id === localProject?.customerId);

    const handleDeleteProject = async () => {
        if (!localProject || !customer) return;
        const confirmationMessage = `Are you sure you want to permanently delete the project "${localProject.projectName}"?\n\nAll associated quotes, orders, and job details will also be removed. This action cannot be undone.`;

        if (window.confirm(confirmationMessage)) {
            setIsDeleting(true);
            try {
                await deleteProject(localProject.id);
                toast.success('Project deleted successfully.');
                navigate(`/customers/${customer.id}`); 
            } catch (error) {
                toast.error((error as Error).message || 'Failed to delete project.');
                console.error("Failed to delete project:", error);
            } finally {
                setIsDeleting(false);
            }
        }
    };
    
    if (isLoading) { return <div className="text-center">Loading project...</div>; }
    if (!localProject) { return <div className="text-center">Project not found.</div>; }
    
    const projectCheckouts = sampleCheckouts.filter(sc => sc.projectId === localProject.id);
    const projectQuotes = quotes.filter(q => q.projectId === localProject.id);
    const projectOrders = materialOrders.filter(o => o.projectId === localProject.id);
    const job = jobs.find(j => j.projectId === localProject.id);
    const projectChangeOrders = changeOrders.filter(co => co.projectId === localProject.id);
    const isQuoteAccepted = projectQuotes.some(q => q.status === QuoteStatus.ACCEPTED);

    return (
        <div className="space-y-8">
            <ProjectInfoHeader project={localProject} customerName={customer?.fullName || 'N/A'} updateProject={updateProject} onEdit={() => setIsEditProjectModalOpen(true)} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-8">
                    <CollapsibleSection
                        title="Sample Checkouts" icon={<Layers className="w-6 h-6" />}
                        actions={ <button onClick={() => setActiveModal('sample')} className="bg-primary hover:bg-secondary text-white font-bold py-1 px-3 text-sm rounded-lg">Check Out</button> }
                    >
                        <SampleCheckoutsSection 
                            project={localProject} projectCheckouts={projectCheckouts} samples={samples} 
                            addSample={addSample} addSampleCheckout={addSampleCheckout} updateSampleCheckout={updateSampleCheckout}
                            extendSampleCheckout={extendSampleCheckout}
                            isModalOpen={activeModal === 'sample'}
                            onCloseModal={() => setActiveModal(null)}
                        />
                    </CollapsibleSection>
                    
                    {isQuoteAccepted && (
                        <CollapsibleSection title="Change Orders" icon={<PlusCircle className="w-6 h-6" />}>
                            <ChangeOrderSection 
                                project={localProject}
                                projectChangeOrders={projectChangeOrders} 
                                addChangeOrder={addChangeOrder}
                                onEditChangeOrder={handleOpenEditChangeOrderModal}
                            />
                        </CollapsibleSection>
                    )}
                </div>
                
                <div className="space-y-8">
                    <CollapsibleSection
                        title="Quotes" icon={<FileText className="w-6 h-6" />}
                        actions={ <button onClick={() => { setEditingQuoteForModal(null); setActiveModal('quote'); }} className="bg-primary hover:bg-secondary text-white font-bold py-1 px-3 text-sm rounded-lg">Add Quote</button> }
                    >
                        <QuotesSection 
                            project={localProject} projectQuotes={projectQuotes} installers={installers} 
                            addQuote={addQuote} updateQuote={updateQuote} updateProject={updateProject} 
                            addInstaller={addInstaller} saveJobDetails={saveJobDetails}
                            isModalOpen={activeModal === 'quote'}
                            onCloseModal={() => setActiveModal(null)}
                            onOpenEditModal={(quote) => {
                                setEditingQuoteForModal(quote);
                                setActiveModal('quote');
                            }}
                            editingQuoteForModal={editingQuoteForModal}
                        />
                    </CollapsibleSection>

                    {isQuoteAccepted && (
                         <CollapsibleSection
                            title="Material Orders" icon={<PackageIcon className="w-6 h-6" />}
                            actions={ <button onClick={() => { setEditingOrder(null); setActiveModal('order'); }} className="bg-primary hover:bg-secondary text-white font-bold py-1 px-3 text-sm rounded-lg">Add Order</button> }
                        >
                            <MaterialOrdersSection 
                                project={localProject}
                                orders={projectOrders}
                                samples={samples}
                                isModalOpen={activeModal === 'order'}
                                onCloseModal={() => { setActiveModal(null); setEditingOrder(null); }}
                                editingOrder={editingOrder}
                                onEditOrder={(order) => {
                                    setEditingOrder(order);
                                    setActiveModal('order');
                                }}
                            />
                        </CollapsibleSection>
                    )}
                </div>
            </div>

            {isQuoteAccepted && <FinalizeJobSection project={localProject} job={job} quotes={projectQuotes} changeOrders={projectChangeOrders} saveJobDetails={saveJobDetails} updateProject={updateProject} />}
        
            <div className="mt-8">
                <CollapsibleSection
                  title="Change History"
                  icon={<History className="w-6 h-6" />}
                  defaultOpen={false}
                >
                  <ActivityHistory history={projectHistory} />
                </CollapsibleSection>
            </div>

            {/* vvvvvvvvvvvv MODIFIED: "Danger Zone" is now admin-only vvvvvvvvvvvv */}
            {currentUser?.roles?.includes('Admin') && (
                <div className="mt-12 p-6 border-t-4 border-red-500 bg-surface rounded-lg shadow-md">
                    <h3 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h3>
                    <p className="text-text-secondary mb-4">Deleting this project will permanently remove all associated data, including quotes, material orders, change orders, and job details. This action cannot be undone.</p>
                    <button
                        onClick={handleDeleteProject}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={18} />
                        {isDeleting ? 'Deleting Project...' : 'Delete This Project'}
                    </button>
                </div>
            )}
            {/* ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */}

            {isEditProjectModalOpen && localProject && (
                <EditProjectModal
                    project={localProject}
                    onClose={() => setIsEditProjectModalOpen(false)}
                    onSave={updateProject}
                />
            )}

            {editingChangeOrder && (
                <EditChangeOrderModal
                    changeOrder={editingChangeOrder}
                    onClose={() => setEditingChangeOrder(null)}
                    onSave={async (data) => {
                        await updateChangeOrder(editingChangeOrder.id, data);
                        setEditingChangeOrder(null);
                    }}
                />
            )}
        </div>
    );
};

export default ProjectDetail;