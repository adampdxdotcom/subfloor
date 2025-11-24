import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Project, Quote, QuoteStatus, ChangeOrder, MaterialOrder, Job } from '../types';
// import { Trash2 } from 'lucide-react'; // REMOVED

import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import EditProjectModal from '../components/EditProjectModal';
import EditChangeOrderModal from '../components/EditChangeOrderModal';
import ProjectInfoHeader from '../components/ProjectInfoHeader';
import SampleCheckoutsSection from '../components/SampleCheckoutsSection';
import QuotesSection from '../components/QuotesSection';
import FinalizeJobSection from '../components/FinalizeJobSection';
import ChangeOrderSection from '../components/ChangeOrderSection';
import MaterialOrdersSection from '../components/MaterialOrdersSection';
import ActivityHistory from '../components/ActivityHistory';
import JobNotesSection from '../components/JobNotesSection';
// import DeleteProjectSection from '../components/DeleteProjectSection'; // REMOVED
import { toast } from 'react-hot-toast';
import * as jobService from '../services/jobService';

const ResponsiveGridLayout = WidthProvider(Responsive);

const ProjectDetail: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    
    const { 
        currentUser, isLayoutEditMode, toggleLayoutEditMode,
        saveCurrentUserPreferences, // FIX: Use the correct function name
        projects, customers, samples, sampleCheckouts, quotes, jobs, installers, changeOrders, materialOrders,
        updateProject, deleteProject, addQuote, updateQuote, 
        saveJobDetails, addInstaller, addChangeOrder, updateChangeOrder, addMaterialOrder,
        projectHistory,
        fetchProjectHistory,
        updateJob,
        isLoading: isDataLoading 
    } = useData();
    
    const [activeModal, setActiveModal] = useState<'sample' | 'quote' | 'order' | null>(null);
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [editingQuoteForModal, setEditingQuoteForModal] = useState<Quote | null>(null);
    const [editingOrder, setEditingOrder] = useState<MaterialOrder | null>(null);
    const [editingChangeOrder, setEditingChangeOrder] = useState<ChangeOrder | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const numericProjectId = useMemo(() => parseInt(projectId || ''), [projectId]);
    const project = useMemo(() => projects.find(p => p.id === numericProjectId), [projects, numericProjectId]);
    const job = useMemo(() => jobs.find(j => j.projectId === numericProjectId), [jobs, numericProjectId]);
    const customer = useMemo(() => customers.find(c => c.id === project?.customerId), [customers, project]);

    const defaultLayouts = useMemo(() => ({
      lg: [
        { i: 'quotes', x: 0, y: 0, w: 8, h: 7, minH: 5, minW: 4 },
        { i: 'job-details', x: 0, y: 7, w: 8, h: 9, minH: 7, minW: 6 },
        { i: 'notes', x: 8, y: 0, w: 4, h: 5, minH: 4, minW: 3 },
        { i: 'sample-checkouts', x: 8, y: 5, w: 4, h: 5, minH: 4, minW: 3 },
        { i: 'change-orders', x: 8, y: 10, w: 4, h: 6, minH: 5, minW: 3 },
        { i: 'material-orders', x: 8, y: 16, w: 4, h: 5, minH: 4, minW: 3 },
        { i: 'history', x: 0, y: 21, w: 12, h: 5, minH: 4, minW: 6 },
        { i: 'danger-zone', x: 0, y: 26, w: 12, h: 3, minH: 3, minW: 4 }, // Re-added 'danger-zone' key for structure, even if visually handled differently
      ]
    }), []);
    
    const [layouts, setLayouts] = useState(defaultLayouts);
    const [originalLayouts, setOriginalLayouts] = useState(layouts);

    useEffect(() => {
        // FIX: Read from currentUser.preferences.projectLayouts
        const savedLayouts = currentUser?.preferences?.projectLayouts;
        // Safety check: Only use saved layouts if they actually contain keys (e.g. 'lg', 'md')
        if (savedLayouts && Object.keys(savedLayouts).length > 0) {
            // SMART MERGE:
            // If the saved layout is missing items (e.g., because they were hidden when saved),
            // inject the default positions for those missing items so they don't collapse.
            const mergedLayouts: ReactGridLayout.Layouts = { ...defaultLayouts };
            
            // Iterate through available breakpoints in the saved layout
            (Object.keys(savedLayouts) as Array<keyof typeof defaultLayouts>).forEach((bp) => {
                const savedItems = savedLayouts[bp] || [];
                const defaultItems = defaultLayouts[bp] || [];
                
                // Find items that exist in default but are missing from saved
                const missingItems = defaultItems.filter(
                    defItem => !savedItems.find(savedItem => savedItem.i === defItem.i)
                );
                
                // Combine saved preferences with the fallback defaults
                mergedLayouts[bp] = [...savedItems, ...missingItems];
            });
            
            setLayouts(mergedLayouts);
        }
    }, [currentUser, defaultLayouts]);

    useEffect(() => {
        if (isLayoutEditMode) {
            setOriginalLayouts(layouts);
        }
    }, [isLayoutEditMode, layouts]);
    

    const handleLayoutChange = (layout: ReactGridLayout.Layout[], allLayouts: ReactGridLayout.Layouts) => {
        setLayouts(allLayouts);
    };

    const handleSaveLayout = () => {
        // FIX: Save using the correct key 'projectLayouts' and correct function
        saveCurrentUserPreferences({ projectLayouts: layouts });
        toast.success("Layout saved!");
        toggleLayoutEditMode();
    };
    
    const handleCancelLayout = () => {
        setLayouts(originalLayouts);
        toggleLayoutEditMode();
    };
    
    const handleResetLayout = () => {
        if (window.confirm("Are you sure you want to reset the layout to its default?")) {
            setLayouts(defaultLayouts);
            saveCurrentUserPreferences({ projectLayouts: defaultLayouts });
            toast.success("Layout has been reset.");
            toggleLayoutEditMode();
        }
    };
    
    useEffect(() => {
        if (isDataLoading || isNaN(numericProjectId)) return;
        const fetchPageSpecificData = async () => {
            fetchProjectHistory(numericProjectId);
            try {
                const jobData = await jobService.getJobForProject(numericProjectId);
                if (jobData) updateJob(jobData);
            } catch (error) { toast.error("Could not load job schedule details."); }
        };
        fetchPageSpecificData();
    }, [numericProjectId, isDataLoading, fetchProjectHistory, updateJob]);

    const handleOpenEditChangeOrderModal = (changeOrder: ChangeOrder) => { setEditingChangeOrder(changeOrder); };
    
    // Logic for deleting the project, called from ProjectInfoHeader
    const handleDeleteProject = async () => {
        if (!project || !customer) return;
        if (window.confirm(`Are you sure you want to permanently delete the project "${project.projectName}"?`)) {
            setIsDeleting(true);
            try {
                await deleteProject(project.id);
                toast.success('Project deleted successfully.');
                navigate(`/customers/${customer.id}`); 
            } catch (error) {
                toast.error((error as Error).message || 'Failed to delete project.');
            } finally {
                setIsDeleting(false);
            }
        }
    };
    
    const handleSaveNotes = async (notes: string) => { if(job) await saveJobDetails({ id: job.id, notes }); };
    
    if (isDataLoading) { return <div className="text-center p-8">Loading project...</div>; }
    if (!project) { return <div className="text-center p-8">Project not found.</div>; }
    
    const projectQuotes = quotes.filter(q => q.projectId === project.id);
    const isQuoteAccepted = projectQuotes.some(q => q.status === QuoteStatus.ACCEPTED);
    const acceptedQuotes = projectQuotes.filter(q => q.status === QuoteStatus.ACCEPTED);
    const projectChangeOrders = changeOrders.filter(co => co.projectId === project.id);
    const projectOrders = materialOrders.filter(o => o.projectId === project.id);

    return (
        <div className="space-y-6">
            <ProjectInfoHeader 
                project={project} 
                customerName={customer?.fullName || 'N/A'} 
                currentUser={currentUser}
                updateProject={updateProject} 
                onEdit={() => setIsEditProjectModalOpen(true)}
                onDeleteProject={handleDeleteProject}
                isDeleting={isDeleting}
                isLayoutEditMode={isLayoutEditMode}
                onSaveLayout={handleSaveLayout}
                onCancelLayout={handleCancelLayout}
                onResetLayout={handleResetLayout}
            />
            
            <ResponsiveGridLayout
                className={`layout ${isLayoutEditMode ? 'edit-mode' : ''}`}
                layouts={layouts}
                onLayoutChange={handleLayoutChange}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={30}
                draggableHandle=".drag-handle"
                isDraggable={isLayoutEditMode}
                isResizable={isLayoutEditMode}
            >
                <div key="quotes" className="h-full overflow-hidden">
                    <QuotesSection 
                        project={project} projectQuotes={projectQuotes} installers={installers} addQuote={addQuote} 
                        updateQuote={updateQuote} updateProject={updateProject} addInstaller={addInstaller} 
                        saveJobDetails={saveJobDetails} isModalOpen={activeModal === 'quote'} onCloseModal={() => setActiveModal(null)}
                        onOpenEditModal={(quote) => { setEditingQuoteForModal(quote); setActiveModal('quote'); }}
                        editingQuoteForModal={editingQuoteForModal}
                    />
                </div>
                
                {isQuoteAccepted && (
                    <div key="job-details" className="h-full overflow-hidden">
                        <FinalizeJobSection project={project} job={job} quotes={projectQuotes} changeOrders={projectChangeOrders} saveJobDetails={saveJobDetails} updateProject={updateProject} />
                    </div>
                )}

                {isQuoteAccepted && job && (
                    <div key="notes" className="h-full overflow-hidden">
                        <JobNotesSection job={job} onSaveNotes={handleSaveNotes} />
                    </div>
                )}

                <div key="sample-checkouts" className="h-full overflow-hidden">
                    {/* MODIFIED: Removed isModalOpen/onCloseModal props as the component now manages its own state */}
                    <SampleCheckoutsSection project={project} />
                </div>
                
                {isQuoteAccepted && (
                    <div key="change-orders" className="h-full overflow-hidden">
                        <ChangeOrderSection project={project} projectChangeOrders={projectChangeOrders} acceptedQuotes={acceptedQuotes} addChangeOrder={addChangeOrder} onEditChangeOrder={handleOpenEditChangeOrderModal} />
                    </div>
                )}
                
                {isQuoteAccepted && (
                    <div key="material-orders" className="h-full overflow-hidden">
                        <MaterialOrdersSection project={project} orders={projectOrders} isModalOpen={activeModal === 'order'} 
                            onCloseModal={() => { setActiveModal(null); setEditingOrder(null); }} editingOrder={editingOrder}
                            onEditOrder={(order) => { setEditingOrder(order); setActiveModal('order'); }}
                        />
                    </div>
                )}
                
                <div key="history" className="h-full overflow-hidden">
                    <ActivityHistory history={projectHistory} />
                </div>
            </ResponsiveGridLayout>

            {isEditProjectModalOpen && project && ( <EditProjectModal project={project} onClose={() => setIsEditProjectModalOpen(false)} onSave={updateProject} /> )}
            {editingChangeOrder && ( <EditChangeOrderModal changeOrder={editingChangeOrder} acceptedQuotes={acceptedQuotes} onClose={() => setEditingChangeOrder(null)} onSave={async (data) => { await updateChangeOrder(editingChangeOrder.id, data); setEditingChangeOrder(null); }} /> )}
        </div>
    );
};

export default ProjectDetail;