import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useProjects, useProjectMutations } from '../hooks/useProjects';
import { useCustomers } from '../hooks/useCustomers';
import { useQuotes, useQuoteMutations } from '../hooks/useQuotes';
import { useJobs, useJobMutations } from '../hooks/useJobs';
import { useChangeOrders, useChangeOrderMutations } from '../hooks/useChangeOrders';
import { useMaterialOrders, useMaterialOrderMutations } from '../hooks/useMaterialOrders';
import { useInstallers, useInstallerMutations } from '../hooks/useInstallers';
import { useSampleCheckouts } from '../hooks/useSampleCheckouts'; // Needed if passed to children or logic
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
import ProjectPhotosSection from '../components/ProjectPhotosSection'; // NEW IMPORT
// import DeleteProjectSection from '../components/DeleteProjectSection'; // REMOVED
import LockedWidget from '../components/LockedWidget'; // NEW IMPORT
import { toast } from 'react-hot-toast';
import * as jobService from '../services/jobService';
import * as notificationService from '../services/notificationService'; // NEW

const ResponsiveGridLayout = WidthProvider(Responsive);

const ProjectDetail: React.FC = () => {
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    
    const { 
        currentUser, isLayoutEditMode, toggleLayoutEditMode,
        saveCurrentUserPreferences,
        projectHistory,
        fetchProjectHistory,
        updateJob,
        refreshNotifications // NEW: Need this to clear the red dot
    } = useData();
    
    // --- HOOKS REPLACEMENT ---
    const { data: projects = [] } = useProjects();
    const { data: customers = [] } = useCustomers();
    const { data: quotes = [] } = useQuotes();
    const { data: jobs = [] } = useJobs();
    const { data: changeOrders = [] } = useChangeOrders();
    const { data: materialOrders = [] } = useMaterialOrders();
    const { data: installers = [] } = useInstallers();
    const { users } = useData(); // Get users list for Project Lead lookup

    const projectMutations = useProjectMutations();
    const quoteMutations = useQuoteMutations();
    const jobMutations = useJobMutations();
    const changeOrderMutations = useChangeOrderMutations();
    const installerMutations = useInstallerMutations();
    // We still rely on useData().isLoading for the initial global fetch check.
    
    const [activeModal, setActiveModal] = useState<'sample' | 'quote' | 'order' | null>(null);
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [editingQuoteForModal, setEditingQuoteForModal] = useState<Quote | null>(null);
    const [editingOrder, setEditingOrder] = useState<MaterialOrder | null>(null);
    const [editingChangeOrder, setEditingChangeOrder] = useState<ChangeOrder | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const numericProjectId = useMemo(() => parseInt(routeProjectId || '', 10), [routeProjectId]);
    const project = useMemo(() => projects.find(p => p.id === numericProjectId), [projects, numericProjectId]);
    const job = useMemo(() => jobs.find(j => j.projectId === numericProjectId), [jobs, numericProjectId]);
    const customer = useMemo(() => customers.find(c => c.id === project?.customerId), [customers, project]);
    
    // --- NEW: Derive Team Info ---
    const projectQuotes = quotes.filter(q => q.projectId === project?.id);
    const acceptedQuote = projectQuotes.find(q => q.status === 'Accepted');
    // Find installer from Accepted Quote, or fallback to first quote with an installer
    const activeInstallerId = acceptedQuote?.installerId || projectQuotes.find(q => q.installerId)?.installerId;
    const activeInstaller = useMemo(() => installers.find(i => i.id === activeInstallerId), [installers, activeInstallerId]);

    const projectLead = useMemo(() => users.find(u => u.userId === project?.managerId), [users, project]);
    // ----------------------------


    const defaultLayouts = useMemo(() => ({
      lg: [
        // ROW 1: Quotes, Samples, Notes (Three columns)
        { i: 'quotes', x: 0, y: 0, w: 4, h: 7, minH: 5, minW: 3 },
        { i: 'sample-checkouts', x: 4, y: 0, w: 4, h: 7, minH: 4, minW: 3 },
        { i: 'notes', x: 8, y: 0, w: 4, h: 7, minH: 4, minW: 3 },
        // ROW 2: Job Details (Full Width)
        { i: 'job-details', x: 0, y: 7, w: 12, h: 9, minH: 7, minW: 6 },
        // ROW 3: Material Orders & Change Orders (Split 50/50)
        { i: 'material-orders', x: 0, y: 16, w: 6, h: 6, minH: 4, minW: 3 },
        { i: 'change-orders', x: 6, y: 16, w: 6, h: 6, minH: 5, minW: 3 },
        // ROW 4: Photos (1/3) & History (2/3)
        { i: 'photos', x: 0, y: 22, w: 4, h: 5, minH: 4, minW: 3 },
        { i: 'history', x: 4, y: 22, w: 8, h: 5, minH: 4, minW: 6 },
      ]
    }), []);
    
    const [layouts, setLayouts] = useState(defaultLayouts);
    const [originalLayouts, setOriginalLayouts] = useState(layouts);

    // Initial load and layout merge
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
    
    const fetchPageSpecificData = useCallback(async () => {
        if (isNaN(numericProjectId)) return;
        
        fetchProjectHistory(numericProjectId);
        try {
            // Check if job is already loaded via DataProvider fetch
            // NOTE: We still use jobService here because the global RQ hook might be delayed.
            // When we updateJob, RQ cache gets updated via DataContext
            if (!job) {
                const jobData = await jobService.getJobForProject(numericProjectId);
                if (jobData) updateJob(jobData);
            }
        } catch (error) { console.error("Could not load job schedule details."); }
    }, [numericProjectId, fetchProjectHistory, updateJob, job]);


    useEffect(() => {
        fetchPageSpecificData();
    }, [numericProjectId, fetchProjectHistory, updateJob, fetchPageSpecificData]);

    // --- NEW: Auto-mark notifications as read when viewing project ---
    useEffect(() => {
        if (numericProjectId && !isNaN(numericProjectId)) {
            // Fire and forget - don't block render
            notificationService.markReferenceAsRead(numericProjectId).then(() => refreshNotifications());
        }
    }, [numericProjectId, refreshNotifications]);


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
    
    const handleOpenEditChangeOrderModal = (changeOrder: ChangeOrder) => { setEditingChangeOrder(changeOrder); };
    
    // Logic for deleting the project, called from ProjectInfoHeader
    const handleDeleteProject = async () => {
        if (!project || !customer) return;
        if (window.confirm(`Are you sure you want to permanently delete the project "${project.projectName}"?`)) {
            setIsDeleting(true);
            try {
                await projectMutations.deleteProject.mutateAsync(project.id);
                toast.success('Project deleted successfully.');
                navigate(`/customers/${customer.id}`); 
            } catch (error) {
                toast.error((error as Error).message || 'Failed to delete project.');
            } finally {
                setIsDeleting(false);
            }
        }
    };
    
    const handleSaveNotes = async (notes: string) => { if(job) await jobMutations.saveJobDetails.mutateAsync({ id: job.id, notes }); };
    
    // Wrappers for child components that expect functions
    const handleUpdateProject = async (data: any) => projectMutations.updateProject.mutateAsync(data);
    const handleAddQuote = async (data: any) => quoteMutations.addQuote.mutateAsync(data);
    const handleUpdateQuote = async (data: any) => quoteMutations.updateQuote.mutateAsync(data);
    const handleSaveJobDetails = async (data: any) => jobMutations.saveJobDetails.mutateAsync(data);
    const handleAddInstaller = async (data: any) => installerMutations.addInstaller.mutateAsync(data);
    const handleAddChangeOrder = async (data: any) => changeOrderMutations.addChangeOrder.mutateAsync(data);
    const handleUpdateChangeOrder = async (id: number, data: any) => changeOrderMutations.updateChangeOrder.mutateAsync({id, data});
    // NOTE: Material Order functions need wrappers if used in MaterialOrdersSection

    if (!project) { return <div className="text-center p-8">Project not found.</div>; }
    
    const isQuoteAccepted = projectQuotes.some(q => q.status === QuoteStatus.ACCEPTED);
    const acceptedQuotes = projectQuotes.filter(q => q.status === QuoteStatus.ACCEPTED);
    const projectChangeOrders = changeOrders.filter(co => co.projectId === project.id);
    const projectOrders = materialOrders.filter(o => o.projectId === project.id);

    return (
        <div className="space-y-6">
            <ProjectInfoHeader 
                project={project} 
                customer={customer} 
                activeInstaller={activeInstaller}
                projectLead={projectLead}
                currentUser={currentUser}
                updateProject={handleUpdateProject} 
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
                        project={project} projectQuotes={projectQuotes} installers={installers} addQuote={handleAddQuote} 
                        updateQuote={handleUpdateQuote} updateProject={handleUpdateProject} addInstaller={handleAddInstaller} 
                        saveJobDetails={handleSaveJobDetails} isModalOpen={activeModal === 'quote'} onCloseModal={() => setActiveModal(null)}
                        onOpenEditModal={(quote) => { setEditingQuoteForModal(quote); setActiveModal('quote'); }}
                        editingQuoteForModal={editingQuoteForModal}
                    />
                </div>
                
                <div key="job-details" className="h-full overflow-hidden">
                    <LockedWidget isLocked={!isQuoteAccepted} title="Job Financials & Schedule">
                        {isQuoteAccepted ? (
                        <FinalizeJobSection project={project} job={job} quotes={projectQuotes} changeOrders={projectChangeOrders} saveJobDetails={handleSaveJobDetails} updateProject={handleUpdateProject} />
                        ) : (
                            <div className="h-full w-full bg-surface/50" /> // Placeholder content
                        )}
                    </LockedWidget>
                </div>

                <div key="notes" className="h-full overflow-hidden">
                    {/* UNLOCKED: Job now exists from creation */}
                    {job ? (
                        <JobNotesSection job={job} onSaveNotes={handleSaveNotes} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-text-tertiary">Loading notes...</div>
                    )}
                </div>

                <div key="sample-checkouts" className="h-full overflow-hidden">
                    {/* MODIFIED: Removed isModalOpen/onCloseModal props as the component now manages its own state */}
                    <SampleCheckoutsSection project={project} />
                </div>
                
                <div key="change-orders" className="h-full overflow-hidden">
                    <LockedWidget isLocked={!isQuoteAccepted} title="Change Orders">
                        {isQuoteAccepted ? (
                        <ChangeOrderSection project={project} projectChangeOrders={projectChangeOrders} acceptedQuotes={acceptedQuotes} addChangeOrder={handleAddChangeOrder} onEditChangeOrder={handleOpenEditChangeOrderModal} />
                        ) : (
                            <div className="h-full w-full bg-surface/50" />
                        )}
                    </LockedWidget>
                </div>
                
                <div key="material-orders" className="h-full overflow-hidden">
                    <LockedWidget isLocked={!isQuoteAccepted} title="Material Orders">
                        {isQuoteAccepted ? (
                        <MaterialOrdersSection project={project} orders={projectOrders} isModalOpen={activeModal === 'order'} 
                            onCloseModal={() => { setActiveModal(null); setEditingOrder(null); }} editingOrder={editingOrder}
                            onEditOrder={(order) => { setEditingOrder(order); setActiveModal('order'); }}
                        />
                        ) : (
                            <div className="h-full w-full bg-surface/50" />
                        )}
                    </LockedWidget>
                </div>

                <div key="photos" className="h-full overflow-hidden">
                    {/* UNLOCKED: Photos can be added anytime */}
                    <ProjectPhotosSection project={project} />
                </div>
                
                <div key="history" className="h-full overflow-hidden">
                    <ActivityHistory history={projectHistory} />
                </div>
            </ResponsiveGridLayout>

            {isEditProjectModalOpen && project && ( <EditProjectModal project={project} onClose={() => setIsEditProjectModalOpen(false)} onSave={handleUpdateProject} /> )}
            {editingChangeOrder && ( <EditChangeOrderModal changeOrder={editingChangeOrder} acceptedQuotes={acceptedQuotes} onClose={() => setEditingChangeOrder(null)} onSave={async (data) => { await handleUpdateChangeOrder(editingChangeOrder.id, data); setEditingChangeOrder(null); }} /> )}
        </div>
    );
};

export default ProjectDetail;