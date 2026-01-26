import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useProjects, useProjectMutations } from '../hooks/useProjects';
import { useCustomers } from '../hooks/useCustomers';
import { useQuotes } from '../hooks/useQuotes';
import { useQuoteMutations } from '../hooks/useQuoteMutations';
import { useJobs, useJobMutations } from '../hooks/useJobs';
import { useChangeOrders } from '../hooks/useChangeOrders';
import { useChangeOrderMutations } from '../hooks/useChangeOrderMutations';
import { useMaterialOrders } from '../hooks/useMaterialOrders';
import { useMaterialOrderMutations } from '../hooks/useMaterialOrderMutations';
import { useInstallers, useInstallerMutations } from '../hooks/useInstallers';
import { Project, Quote, QuoteStatus, ChangeOrder, MaterialOrder } from '../types';

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
import ProjectPhotosSection from '../components/ProjectPhotosSection';
import LockedWidget from '../components/LockedWidget';
import { toast } from 'react-hot-toast';
import * as jobService from '../services/jobService';
import * as notificationService from '../services/notificationService';

const ResponsiveGridLayout = WidthProvider(Responsive);

const ProjectDetail: React.FC = () => {
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    
    const { 
        currentUser, isLayoutEditMode, toggleLayoutEditMode,
        saveCurrentUserPreferences,
        projectHistory,
        fetchProjectHistory,
        updateJob,
        refreshNotifications,
        users
    } = useData();
    
    // --- HOOKS ---
    const { data: projects = [] } = useProjects();
    const { data: customers = [] } = useCustomers();
    const { data: quotes = [] } = useQuotes();
    const { data: jobs = [] } = useJobs();
    const { data: changeOrders = [] } = useChangeOrders();
    const { data: materialOrders = [] } = useMaterialOrders();
    const { data: installers = [] } = useInstallers();

    const projectMutations = useProjectMutations();
    const quoteMutations = useQuoteMutations();
    const jobMutations = useJobMutations();
    const changeOrderMutations = useChangeOrderMutations();
    const installerMutations = useInstallerMutations();
    
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
    
    const projectQuotes = quotes.filter(q => q.projectId === project?.id);
    const acceptedQuote = projectQuotes.find(q => q.status === 'Accepted');
    const activeInstallerId = acceptedQuote?.installerId || projectQuotes.find(q => q.installerId)?.installerId;
    const activeInstaller = useMemo(() => installers.find(i => i.id === activeInstallerId), [installers, activeInstallerId]);
    const projectLead = useMemo(() => users.find(u => u.userId === project?.managerId), [users, project]);

    const defaultLayouts = useMemo(() => ({
      lg: [
        { i: 'quotes', x: 0, y: 0, w: 4, h: 7, minH: 5, minW: 3 },
        { i: 'sample-checkouts', x: 4, y: 0, w: 4, h: 7, minH: 4, minW: 3 },
        { i: 'notes', x: 8, y: 0, w: 4, h: 7, minH: 4, minW: 3 },
        { i: 'job-details', x: 0, y: 7, w: 12, h: 9, minH: 7, minW: 6 },
        { i: 'material-orders', x: 0, y: 16, w: 6, h: 6, minH: 4, minW: 3 },
        { i: 'change-orders', x: 6, y: 16, w: 6, h: 6, minH: 5, minW: 3 },
        { i: 'photos', x: 0, y: 22, w: 4, h: 5, minH: 4, minW: 3 },
        { i: 'history', x: 4, y: 22, w: 8, h: 5, minH: 4, minW: 6 },
      ]
    }), []);
    
    const [layouts, setLayouts] = useState(defaultLayouts);
    const [originalLayouts, setOriginalLayouts] = useState(layouts);

    useEffect(() => {
        const savedLayouts = currentUser?.preferences?.projectLayouts;
        if (savedLayouts && Object.keys(savedLayouts).length > 0) {
            const mergedLayouts: ReactGridLayout.Layouts = { ...defaultLayouts };
            (Object.keys(savedLayouts) as Array<keyof typeof defaultLayouts>).forEach((bp) => {
                const savedItems = savedLayouts[bp] || [];
                const defaultItems = defaultLayouts[bp] || [];
                const missingItems = defaultItems.filter(
                    defItem => !savedItems.find(savedItem => savedItem.i === defItem.i)
                );
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
            if (!job) {
                const jobData = await jobService.getJobForProject(numericProjectId);
                if (jobData) updateJob(jobData);
            }
        } catch (error) { console.error("Could not load job schedule details."); }
    }, [numericProjectId, fetchProjectHistory, updateJob, job]);

    useEffect(() => {
        fetchPageSpecificData();
    }, [numericProjectId, fetchPageSpecificData]);

    useEffect(() => {
        if (numericProjectId && !isNaN(numericProjectId)) {
            notificationService.markReferenceAsRead(numericProjectId).then(() => refreshNotifications());
        }
    }, [numericProjectId, refreshNotifications]);

    const handleLayoutChange = (layout: ReactGridLayout.Layout[], allLayouts: ReactGridLayout.Layouts) => {
        setLayouts(allLayouts);
    };

    const handleSaveLayout = () => {
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
    
    const handleDeleteProject = async () => {
        if (!project || !customer) return;
        if (window.confirm(`Are you sure you want to permanently delete the project "${project.projectName}"?`)) {
            setIsDeleting(true);
            try {
                await projectMutations.deleteProject(project.id);
                toast.success('Project deleted successfully.');
                navigate(`/customers/${customer.id}`); 
            } catch (error) {
                toast.error((error as Error).message || 'Failed to delete project.');
            } finally {
                setIsDeleting(false);
            }
        }
    };
    
    const handleSaveNotes = async (notes: string) => { if(job) await jobMutations.saveJobDetails({ projectId: project.id, notes }); };
    
    const handleUpdateProject = async (data: any) => projectMutations.updateProject(data);
    const handleAddQuote = async (data: any) => quoteMutations.addQuote(data);
    const handleUpdateQuote = async (data: any) => quoteMutations.updateQuote(data);
    const handleSaveJobDetails = async (data: any) => jobMutations.saveJobDetails(data);
    const handleAddInstaller = async (data: any) => installerMutations.addInstaller(data);
    const handleAddChangeOrder = async (data: any) => changeOrderMutations.addChangeOrder(data);
    const handleUpdateChangeOrder = async (id: number, data: any) => changeOrderMutations.updateChangeOrder({id, data});

    if (!project) { return <div className="text-center p-8">Project not found.</div>; }
    
    const isQuoteAccepted = projectQuotes.some(q => q.status === QuoteStatus.ACCEPTED);
    const acceptedQuotes = projectQuotes.filter(q => q.status === QuoteStatus.ACCEPTED);
    const projectChangeOrders = changeOrders.filter(co => co.projectId === project.id);
    const projectOrders = materialOrders.filter(o => o.projectId === project.id);

    return (
        <div className="space-y-8">
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
                <div key="quotes" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
                    <QuotesSection 
                        project={project} projectQuotes={projectQuotes} installers={installers} addQuote={handleAddQuote} 
                        updateQuote={handleUpdateQuote} updateProject={handleUpdateProject} addInstaller={handleAddInstaller} 
                        saveJobDetails={handleSaveJobDetails} isModalOpen={activeModal === 'quote'} onCloseModal={() => setActiveModal(null)}
                        onOpenEditModal={(quote) => { setEditingQuoteForModal(quote); setActiveModal('quote'); }}
                        editingQuoteForModal={editingQuoteForModal}
                    />
                </div>
                
                <div key="job-details" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
                    <LockedWidget isLocked={!isQuoteAccepted} title="Job Financials & Schedule">
                        {isQuoteAccepted ? (
                        <FinalizeJobSection project={project} job={job} quotes={projectQuotes} changeOrders={projectChangeOrders} materialOrders={projectOrders} />
                        ) : (
                            <div className="h-full w-full bg-surface/50" />
                        )}
                    </LockedWidget>
                </div>

                <div key="notes" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
                    {job ? (
                        <JobNotesSection job={job} onSaveNotes={handleSaveNotes} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-text-tertiary">Loading notes...</div>
                    )}
                </div>

                <div key="sample-checkouts" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
                    <SampleCheckoutsSection project={project} />
                </div>
                
                <div key="change-orders" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
                    <LockedWidget isLocked={!isQuoteAccepted} title="Change Orders">
                        {isQuoteAccepted ? (
                        <ChangeOrderSection project={project} projectChangeOrders={projectChangeOrders} acceptedQuotes={acceptedQuotes} addChangeOrder={handleAddChangeOrder} onEditChangeOrder={handleOpenEditChangeOrderModal} />
                        ) : (
                            <div className="h-full w-full bg-surface/50" />
                        )}
                    </LockedWidget>
                </div>
                
                <div key="material-orders" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
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

                <div key="photos" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
                    <ProjectPhotosSection project={project} />
                </div>
                
                <div key="history" className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10 overflow-hidden h-full">
                    <ActivityHistory history={projectHistory} />
                </div>
            </ResponsiveGridLayout>

            {isEditProjectModalOpen && project && ( <EditProjectModal project={project} onClose={() => setIsEditProjectModalOpen(false)} onSave={handleUpdateProject} /> )}
            {editingChangeOrder && ( <EditChangeOrderModal changeOrder={editingChangeOrder} acceptedQuotes={acceptedQuotes} onClose={() => setEditingChangeOrder(null)} onSave={async (data) => { await handleUpdateChangeOrder(editingChangeOrder.id, data); setEditingChangeOrder(null); }} /> )}
        </div>
    );
};

export default ProjectDetail;