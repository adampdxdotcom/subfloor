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
                className="w-full p-2 bg-background border border-border rounded cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedProject ? "text-text-primary" : "text-text-secondary"}>
                    {selectedProject 
                        ? `${selectedProject.projectName} (${selectedProject.customerName})` 
                        : "Select a Project..."}
                </span>
                <Search size={16} className="text-text-tertiary" />
            </div>

            {isOpen && (
                <div className="absolute z-20 w-full bg-surface border border-border rounded-b-md mt-1 shadow-xl max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-surface border-b border-border">
                        <input 
                            type="text" 
                            placeholder="Search projects..." 
                            autoFocus
                            className="w-full p-1 bg-background border border-border rounded text-sm text-text-primary"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {filteredProjects.length === 0 ? (
                        <div className="p-3 text-center text-text-secondary text-sm">No projects found.</div>
                    ) : (
                        filteredProjects.map(project => (
                            <div 
                                key={project.id}
                                onClick={() => {
                                    onProjectSelect(project);
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                                className={`p-2 hover:bg-background cursor-pointer flex justify-between items-center ${selectedProjectId === project.id ? 'bg-primary/10' : ''}`}
                            >
                                <div>
                                    <div className="text-text-primary font-medium text-sm">{project.projectName}</div>
                                    <div className="text-text-secondary text-xs">{project.customerName}</div>
                                </div>
                                {selectedProjectId === project.id && <Check size={16} className="text-primary" />}
                            </div>
                        ))
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