import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Project, Quote, QuoteStatus, ChangeOrder, MaterialOrder, Job } from '../types';
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
import * as jobService from '../services/jobService'; // Keep the service import

const ProjectDetail: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    
    const { 
        currentUser,
        projects, customers, samples, sampleCheckouts, quotes, jobs, installers, changeOrders, materialOrders,
        addSample, updateProject, deleteProject, addSampleCheckout, updateSampleCheckout, addQuote, updateQuote, 
        saveJobDetails, addInstaller, addChangeOrder, updateChangeOrder, addMaterialOrder, updateMaterialOrder,
        extendSampleCheckout,
        projectHistory,
        fetchProjectHistory,
        updateJob, // We will use this to update the global state
        isLoading: isDataLoading 
    } = useData();
    
    const [activeModal, setActiveModal] = useState<'sample' | 'quote' | 'order' | null>(null);
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [editingQuoteForModal, setEditingQuoteForModal] = useState<Quote | null>(null);
    const [editingOrder, setEditingOrder] = useState<MaterialOrder | null>(null);
    const [editingChangeOrder, setEditingChangeOrder] = useState<ChangeOrder | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // --- DERIVED STATE: This is the correct pattern ---
    const numericProjectId = useMemo(() => parseInt(projectId || ''), [projectId]);

    const project = useMemo(() => 
        projects.find(p => p.id === numericProjectId), 
    [projects, numericProjectId]);

    const job = useMemo(() => 
        jobs.find(j => j.projectId === numericProjectId), 
    [jobs, numericProjectId]);
    
    const customer = useMemo(() => 
        customers.find(c => c.id === project?.customerId), 
    [customers, project]);

    // --- RE-INTRODUCED FETCH LOGIC: This was the missing piece ---
    useEffect(() => {
        if (isDataLoading || isNaN(numericProjectId)) {
            return;
        }

        const fetchPageSpecificData = async () => {
            // Fetch the history for this project
            fetchProjectHistory(numericProjectId);

            // Fetch the detailed job (with appointments) and update global state
            try {
                const jobData = await jobService.getJobForProject(numericProjectId);
                // Update the job in the global context, which will cause this component to re-render with the full data
                updateJob(jobData);
            } catch (error) {
                // A 404 error is expected if a job hasn't been created yet. We don't need to do anything.
                // Any other error should be logged.
                if ((error as any).response?.status !== 404) {
                    console.error("Failed to fetch detailed job:", error);
                    toast.error("Could not load job schedule details.");
                }
            }
        };

        fetchPageSpecificData();
    }, [numericProjectId, isDataLoading, fetchProjectHistory, updateJob]);

    const handleOpenEditChangeOrderModal = (changeOrder: ChangeOrder) => {
        setEditingChangeOrder(changeOrder);
    };

    const handleDeleteProject = async () => {
        if (!project || !customer) return;
        const confirmationMessage = `Are you sure you want to permanently delete the project "${project.projectName}"?\n\nAll associated quotes, orders, and job details will also be removed. This action cannot be undone.`;

        if (window.confirm(confirmationMessage)) {
            setIsDeleting(true);
            try {
                await deleteProject(project.id);
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
    
    if (isDataLoading) { return <div className="text-center p-8">Loading project...</div>; }
    if (!project) { return <div className="text-center p-8">Project not found.</div>; }
    
    const projectCheckouts = sampleCheckouts.filter(sc => sc.projectId === project.id);
    const projectQuotes = quotes.filter(q => q.projectId === project.id);
    const projectOrders = materialOrders.filter(o => o.projectId === project.id);
    const projectChangeOrders = changeOrders.filter(co => co.projectId === project.id);
    const isQuoteAccepted = projectQuotes.some(q => q.status === QuoteStatus.ACCEPTED);
    const acceptedQuotes = projectQuotes.filter(q => q.status === QuoteStatus.ACCEPTED);

    return (
        <div className="space-y-8">
            <ProjectInfoHeader project={project} customerName={customer?.fullName || 'N/A'} updateProject={updateProject} onEdit={() => setIsEditProjectModalOpen(true)} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-8">
                    <CollapsibleSection
                        title="Sample Checkouts" icon={<Layers className="w-6 h-6" />}
                        actions={ <button onClick={() => setActiveModal('sample')} className="bg-primary hover:bg-secondary text-white font-bold py-1 px-3 text-sm rounded-lg">Check Out</button> }
                    >
                        <SampleCheckoutsSection 
                            project={project} projectCheckouts={projectCheckouts} samples={samples} 
                            addSample={addSample} addSampleCheckout={addSampleCheckout} updateSampleCheckout={updateSampleCheckout}
                            extendSampleCheckout={extendSampleCheckout}
                            isModalOpen={activeModal === 'sample'}
                            onCloseModal={() => setActiveModal(null)}
                        />
                    </CollapsibleSection>
                    
                    {isQuoteAccepted && (
                        <CollapsibleSection title="Change Orders" icon={<PlusCircle className="w-6 h-6" />}>
                            <ChangeOrderSection 
                                project={project}
                                projectChangeOrders={projectChangeOrders} 
                                acceptedQuotes={acceptedQuotes}
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
                            project={project} projectQuotes={projectQuotes} installers={installers} 
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
                                project={project}
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

            {isQuoteAccepted && (
                <FinalizeJobSection 
                    project={project} 
                    job={job}
                    quotes={projectQuotes} 
                    changeOrders={projectChangeOrders} 
                    saveJobDetails={saveJobDetails} 
                    updateProject={updateProject} 
                />
            )}
        
            <div className="mt-8">
                <CollapsibleSection
                  title="Change History"
                  icon={<History className="w-6 h-6" />}
                  defaultOpen={false}
                >
                  <ActivityHistory history={projectHistory} />
                </CollapsibleSection>
            </div>

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

            {isEditProjectModalOpen && project && (
                <EditProjectModal
                    project={project}
                    onClose={() => setIsEditProjectModalOpen(false)}
                    onSave={updateProject}
                />
            )}

            {editingChangeOrder && (
                <EditChangeOrderModal
                    changeOrder={editingChangeOrder}
                    acceptedQuotes={acceptedQuotes}
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