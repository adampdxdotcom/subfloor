import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus, SampleCheckout } from '../types';
import { ChevronRight, Bell, Clock, Undo2, Calendar, HardHat, Layers } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getImageUrl } from '../utils/apiConfig';

// --- Helper to find Product Variant Name ---
const getCheckoutDisplayName = (checkout: SampleCheckout, products: any[]) => {
    for (const p of products) {
        const variant = p.variants.find((v: any) => String(v.id) === String(checkout.variantId));
        if (variant) {
            return `${p.name} - ${variant.name}`;
        }
    }
    return 'Unknown Sample';
};

const getStatusColor = (status: ProjectStatus): string => {
    switch (status) {
        case ProjectStatus.NEW: return 'bg-surface-container text-text-secondary border border-outline';
        case ProjectStatus.SCHEDULED: return 'bg-primary-container text-primary font-bold';
        case ProjectStatus.ACCEPTED: return 'bg-success-container text-success font-bold';
        case ProjectStatus.QUOTING: return 'bg-secondary-container text-on-secondary-container';
        case ProjectStatus.SAMPLE_CHECKOUT: return 'bg-warning-container text-warning font-bold';
        case ProjectStatus.COMPLETED: return 'bg-surface text-text-primary border border-outline';
        case ProjectStatus.AWAITING_DECISION: return 'bg-surface-container-highest text-text-secondary';
        case ProjectStatus.CANCELLED: return 'bg-error-container text-error';
        default: return 'bg-surface-container text-text-secondary';
    }
};

const getOverdueAlert = (project: Project, sampleCheckouts: SampleCheckout[]): { color: string; text: string } | null => {
    const projectActiveCheckouts = sampleCheckouts.filter(sc => sc.projectId === project.id && sc.actualReturnDate === null);
    if (projectActiveCheckouts.length === 0) return null;
    const mostUrgentCheckout = projectActiveCheckouts.sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime())[0];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = new Date(mostUrgentCheckout.expectedReturnDate); dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) { return { color: 'text-warning', text: 'Sample due today' }; }
    if (diffDays < 0) { return { color: 'text-error', text: 'Sample is overdue' }; }
    return null;
};

const ProjectCard = ({ project }: { project: Project }) => {
    const { customers, sampleCheckouts, products, updateSampleCheckout, extendSampleCheckout, jobs, installers } = useData();
    const customer = customers.find(c => c.id === project.customerId);
    const statusColor = getStatusColor(project.status);
    const overdueAlert = getOverdueAlert(project, sampleCheckouts);

    const scheduleInfo = useMemo(() => {
        const job = jobs.find(j => j.projectId === project.id);
        const appointments = job?.appointments || [];
        if (appointments.length === 0) return null;

        const sorted = [...appointments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        const start = sorted[0].startDate;
        const end = sorted[sorted.length - 1].endDate;
        const installerId = sorted[0].installerId;
        const installer = installers.find(i => i.id === installerId);
        
        const startDateString = formatDate(start);
        const endDateString = formatDate(end);
        const dateString = startDateString === endDateString ? startDateString : `${startDateString} - ${endDateString}`;

        return {
            dateString,
            installerName: installer?.installerName || (installer as any)?.name || 'Assigned Installer'
        };
    }, [jobs, project.id, installers]);

    const selectedImages = useMemo(() => {
        const selected = sampleCheckouts.filter(sc => sc.projectId === project.id && sc.isSelected);
        return selected.slice(0, 4).map(sc => {
            for (const p of products) {
                if (sc.interestVariantId) {
                    const v = p.variants.find((v: any) => String(v.id) === String(sc.interestVariantId));
                    if (v) return { url: v.thumbnailUrl || v.imageUrl || p.defaultThumbnailUrl || p.defaultImageUrl, name: v.name };
                }
                const v = p.variants.find((v: any) => String(v.id) === String(sc.variantId));
                if (v) return { url: v.thumbnailUrl || v.imageUrl || p.defaultThumbnailUrl || p.defaultImageUrl, name: v.name };
            }
            return null;
        }).filter(Boolean);
    }, [sampleCheckouts, products, project.id]);

    const activeCheckouts = useMemo(() => {
        return sampleCheckouts.filter(sc => sc.projectId === project.id && sc.actualReturnDate === null);
    }, [sampleCheckouts, project.id]);

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        e.preventDefault();
        action();
    };

    return (
        <Link to={`/projects/${project.id}`} className="block bg-surface-container-high p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 w-96 flex-shrink-0 border border-outline/10 group">
            <div className="flex justify-between items-start">
                <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-lg text-text-primary truncate">{project.projectName}</h3>
                    <p className="text-sm text-text-secondary truncate font-medium">{customer?.fullName}</p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                    {overdueAlert && (
                        <div title={overdueAlert.text} className={`p-1.5 rounded-full bg-error-container ${overdueAlert.color}`}>
                            <Bell size={14} />
                        </div>
                    )}
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor}`}>{project.status}</div>
                </div>
            </div>

            {/* Logistics Block */}
            {scheduleInfo && (
                <div className="mt-4 flex items-start gap-4 text-sm text-text-secondary">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                             <Calendar className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="truncate">{scheduleInfo.dateString}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                            <HardHat className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="truncate">{scheduleInfo.installerName}</span>
                    </div>
                </div>
            )}

            {activeCheckouts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-outline/20">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-3">Active Samples</h4>
                    <div className="space-y-2.5">
                        {activeCheckouts.map(checkout => {
                            const displayName = getCheckoutDisplayName(checkout, products);
                            return (
                                <div key={checkout.id} className="flex justify-between items-center text-sm group/sample">
                                    <span className="text-text-primary truncate" title={displayName}>{displayName}</span>
                                    <div className="flex items-center gap-2 opacity-0 group-hover/sample:opacity-100 transition-opacity">
                                        <button onClick={(e) => handleActionClick(e, () => extendSampleCheckout(checkout))} className="p-1.5 bg-surface hover:bg-surface-hover text-primary rounded-full border border-outline">
                                            <Clock size={14} />
                                        </button>
                                        <button onClick={(e) => handleActionClick(e, () => updateSampleCheckout(checkout))} className="p-1.5 bg-primary-container hover:bg-primary text-primary hover:text-on-primary rounded-full">
                                            <Undo2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected Variants (Thumbnails) */}
            {selectedImages.length > 0 && (
                <div className="mt-4 flex gap-2">
                    {selectedImages.map((img, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-md bg-surface-container-low border border-outline/20 overflow-hidden shrink-0" title={img?.name}>
                            {img?.url ? (
                                <img src={getImageUrl(img.url)} alt={img?.name || 'Selected variant'} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                                    <Layers size={14} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 flex justify-between items-center text-xs text-text-secondary pt-3 border-t border-outline/10">
                <span className="bg-surface-container px-2 py-1 rounded-md">{project.projectType}</span>
                <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform"/>
            </div>
        </Link>
    );
};

const ProjectCarousel = ({ title, projects }: { title: string, projects: Project[] }) => {
    return (
        <div className="mb-12">
            {title && <h2 className="text-2xl font-semibold mb-4 text-text-primary pl-1">{title}</h2>}
            {projects.length > 0 ? (
                <div className="flex gap-6 overflow-x-auto pb-4 after:content-[''] after:min-w-[1rem]">
                    {projects.map(project => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            ) : (
                <p className="text-text-secondary italic">No projects in this category.</p>
            )}
        </div>
    );
};

export default ProjectCarousel;