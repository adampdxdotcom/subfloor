import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus, SampleCheckout } from '../types';
import { ChevronRight, Bell, Clock, Undo2 } from 'lucide-react';

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
    const { customers, sampleCheckouts, products, updateSampleCheckout, extendSampleCheckout } = useData();
    const customer = customers.find(c => c.id === project.customerId);
    const statusColor = getStatusColor(project.status);
    const overdueAlert = getOverdueAlert(project, sampleCheckouts);

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
                <div>
                    <h3 className="font-bold text-lg text-text-primary truncate">{project.projectName}</h3>
                    <p className="text-sm text-text-secondary truncate">{customer?.fullName}</p>
                </div>
                <div className="flex items-center space-x-2">
                    {overdueAlert && (<div title={overdueAlert.text}><Bell className={`w-5 h-5 ${overdueAlert.color}`} /></div>)}
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor}`}>{project.status}</div>
                </div>
            </div>

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
                <div className="flex gap-6 overflow-x-auto pb-4">
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