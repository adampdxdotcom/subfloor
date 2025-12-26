import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus, SampleCheckout } from '../types';
import { ChevronRight, Bell, Clock, Undo2, Calendar, HardHat, Layers } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getImageUrl } from '../utils/apiConfig';

// --- NEW: Helper to find Product Variant Name ---
const getCheckoutDisplayName = (checkout: SampleCheckout, products: any[]) => {
    for (const p of products) {
        const variant = p.variants.find((v: any) => String(v.id) === String(checkout.variantId));
        if (variant) {
            return `${p.name} - ${variant.name}`;
        }
    }
    // Fallback if variant not found (or legacy data)
    return 'Unknown Sample';
};

const getStatusColor = (status: ProjectStatus): string => {
    switch (status) {
        case ProjectStatus.NEW: return 'bg-gray-600 text-white';
        case ProjectStatus.SCHEDULED: return 'bg-green-500 text-white';
        case ProjectStatus.ACCEPTED: return 'bg-teal-500 text-white';
        case ProjectStatus.QUOTING: return 'bg-blue-500 text-white';
        case ProjectStatus.SAMPLE_CHECKOUT: return 'bg-yellow-500 text-gray-800';
        case ProjectStatus.COMPLETED: return 'bg-indigo-500 text-white';
        case ProjectStatus.AWAITING_DECISION: return 'bg-gray-500 text-white';
        case ProjectStatus.CANCELLED: return 'bg-red-800 text-gray-300';
        default: return 'bg-gray-700 text-white';
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
    if (diffDays === 0) { return { color: 'text-yellow-400', text: 'Sample due today' }; }
    if (diffDays < 0 && diffDays >= -3) { return { color: 'text-red-500', text: 'Sample is overdue' }; }
    if (diffDays < -3) { return { color: 'text-purple-500', text: 'Sample is very overdue' }; }
    return null;
};

const ProjectCard = ({ project }: { project: Project }) => {
    const { customers, sampleCheckouts, products, updateSampleCheckout, extendSampleCheckout, jobs, installers } = useData();
    const customer = customers.find(c => c.id === project.customerId);
    const statusColor = getStatusColor(project.status);
    const overdueAlert = getOverdueAlert(project, sampleCheckouts);

    // --- Logistics Info (Dates & Installer) ---
    const scheduleInfo = useMemo(() => {
        const job = jobs.find(j => j.projectId === project.id);
        const appointments = job?.appointments || [];
        
        if (appointments.length === 0) return null;

        // Sort appointments to find earliest start and latest end
        const sorted = [...appointments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        const start = sorted[0].startDate;
        const end = sorted[sorted.length - 1].endDate;
        
        // Find Installer (Grab from first appointment)
        const installerId = sorted[0].installerId;
        const installer = installers.find(i => i.id === installerId);
        
        // Format Date Range
        const startDateString = formatDate(start);
        const endDateString = formatDate(end);
        const dateString = startDateString === endDateString ? startDateString : `${startDateString} - ${endDateString}`;

        return {
            dateString,
            installerName: installer?.installerName || (installer as any)?.name || 'Assigned Installer'
        };
    }, [jobs, project.id, installers]);

    // --- Selections (Thumbnails) ---
    const selectedImages = useMemo(() => {
        const selected = sampleCheckouts.filter(sc => sc.projectId === project.id && sc.isSelected);
        return selected.slice(0, 4).map(sc => {
            // Find the product/variant image
            for (const p of products) {
                // Check Interest Variant First (The specific color)
                if (sc.interestVariantId) {
                    const v = p.variants.find((v: any) => String(v.id) === String(sc.interestVariantId));
                    if (v) return { url: v.thumbnailUrl || v.imageUrl || p.defaultThumbnailUrl || p.defaultImageUrl, name: v.name };
                }
                // Fallback to Board Variant
                const v = p.variants.find((v: any) => String(v.id) === String(sc.variantId));
                if (v) return { url: v.thumbnailUrl || v.imageUrl || p.defaultThumbnailUrl || p.defaultImageUrl, name: v.name };
            }
            return null;
        }).filter(Boolean); // Remove nulls
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
        <Link to={`/projects/${project.id}`} className="block bg-surface p-4 rounded-lg shadow-md hover:shadow-lg hover:bg-gray-700 transition-all duration-300 w-96 flex-shrink-0">
            <div className="flex justify-between items-start">
                <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-lg text-text-primary truncate">{project.projectName}</h3>
                    <p className="text-sm text-text-secondary truncate">{customer?.fullName}</p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                    {overdueAlert && (<div title={overdueAlert.text}><Bell className={`w-5 h-5 ${overdueAlert.color}`} /></div>)}
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor}`}>{project.status}</div>
                </div>
            </div>

            {/* Logistics Block */}
            {scheduleInfo && (
                <div className="mt-3 flex items-start gap-4 text-sm text-text-secondary">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{scheduleInfo.dateString}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <HardHat className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{scheduleInfo.installerName}</span>
                    </div>
                </div>
            )}

            {activeCheckouts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                    <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Samples Out</h4>
                    <div className="space-y-2">
                        {activeCheckouts.map(checkout => {
                            const displayName = getCheckoutDisplayName(checkout, products);
                            return (
                                <div key={checkout.id} className="flex justify-between items-center text-sm">
                                    <span className="text-text-primary truncate" title={displayName}>{displayName}</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => handleActionClick(e, () => extendSampleCheckout(checkout))} className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded flex items-center gap-1"><Clock size={12} /> Extend</button>
                                        <button onClick={(e) => handleActionClick(e, () => updateSampleCheckout(checkout))} className="text-xs bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded flex items-center gap-1"><Undo2 size={12} /> Return</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected Variants (Thumbnails) */}
            {selectedImages.length > 0 && (
                <div className="mt-3 flex gap-2">
                    {selectedImages.map((img, idx) => (
                        <div key={idx} className="w-8 h-8 rounded bg-background border border-border overflow-hidden shrink-0" title={img?.name}>
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

            <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
                <span>{project.projectType}</span>
                <ChevronRight className="w-5 h-5 text-accent"/>
            </div>
        </Link>
    );
};

const ProjectCarousel = ({ title, projects }: { title: string, projects: Project[] }) => {
    return (
        <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-text-primary">{title}</h2>
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