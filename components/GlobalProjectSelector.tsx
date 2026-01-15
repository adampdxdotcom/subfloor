import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Project } from '../types';
import { Check, Search } from 'lucide-react';

interface GlobalProjectSelectorProps {
    selectedProjectId: number | null;
    onProjectSelect: (project: Project) => void;
}

const GlobalProjectSelector: React.FC<GlobalProjectSelectorProps> = ({ selectedProjectId, onProjectSelect }) => {
    const { projects, customers } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Combine Project + Customer Name for easy display/search
    const enrichedProjects = useMemo(() => {
        return projects.map(p => {
            const customer = customers.find(c => c.id === p.customerId);
            return {
                ...p,
                customerName: customer ? customer.fullName : 'Unknown Customer'
            };
        });
    }, [projects, customers]);

    const filteredProjects = useMemo(() => {
        if (!searchTerm) return enrichedProjects.slice(0, 10); // Limit initial list
        const lower = searchTerm.toLowerCase();
        return enrichedProjects.filter(p => 
            p.projectName.toLowerCase().includes(lower) || 
            p.customerName.toLowerCase().includes(lower)
        );
    }, [searchTerm, enrichedProjects]);

    const selectedProject = enrichedProjects.find(p => p.id === selectedProjectId);

    return (
        <div className="relative">
            <div 
                className="w-full bg-surface-container border border-outline/50 rounded-lg px-4 py-2.5 cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedProject ? "text-text-primary" : "text-text-tertiary"}>
                    {selectedProject 
                        ? `${selectedProject.projectName} (${selectedProject.customerName})` 
                        : "Select a Project..."}
                </span>
                <Search size={18} className="text-text-secondary" />
            </div>

            {isOpen && (
                <div className="absolute z-20 w-full bg-surface-container-high border border-outline/20 rounded-lg mt-1 shadow-xl max-h-72 overflow-y-auto flex flex-col">
                    <div className="p-2 sticky top-0 bg-surface-container-high border-b border-outline/10">
                        <input 
                            type="text" 
                            placeholder="Search projects..." 
                            autoFocus
                            className="w-full bg-surface-container border border-outline/50 rounded-md px-2 py-1 text-sm text-text-primary"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {filteredProjects.length === 0 ? (
                        <div className="p-4 text-center text-text-secondary text-sm">No projects found.</div>
                    ) : (
                        <div className="overflow-y-auto">
                            {filteredProjects.map(project => (
                                <div 
                                    key={project.id}
                                    onClick={() => {
                                        onProjectSelect(project);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`px-4 py-3 hover:bg-primary-container/30 cursor-pointer flex justify-between items-center ${selectedProjectId === project.id ? 'bg-primary-container/50' : ''}`}
                                >
                                    <div>
                                        <div className="text-text-primary font-medium text-sm">{project.projectName}</div>
                                        <div className="text-text-secondary text-xs">{project.customerName}</div>
                                    </div>
                                    {selectedProjectId === project.id && <Check size={16} className="text-primary" />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* Click outside closer (simple overlay) */}
            {isOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
            )}
        </div>
    );
};

export default GlobalProjectSelector;