import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus, SampleCheckout } from '../types';
import { ChevronRight, Filter, Bell, PackagePlus, Clock, Undo2 } from 'lucide-react';
import QuickCheckoutModal from '../components/QuickCheckoutModal';
import ProjectCarousel from '../components/ProjectCarousel'; 

const Dashboard: React.FC = () => {
  const { projects, sampleCheckouts } = useData(); 
  const [filter, setFilter] = useState<ProjectStatus | 'All' | 'Recap'>('Recap');
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  
  const safeDateSort = (a: Project, b: Project) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
  };

  const samplesOutProjects = useMemo(() => {
    const projectsWithActiveCheckouts = new Set<number>();
    sampleCheckouts.forEach(sc => {
        if (sc.actualReturnDate === null) {
            projectsWithActiveCheckouts.add(sc.projectId);
        }
    });

    return projects
        .filter(p => projectsWithActiveCheckouts.has(p.id))
        .sort((a, b) => {
            const earliestA = Math.min(...sampleCheckouts.filter(sc => sc.projectId === a.id && !sc.actualReturnDate).map(sc => new Date(sc.expectedReturnDate).getTime()));
            const earliestB = Math.min(...sampleCheckouts.filter(sc => sc.projectId === b.id && !sc.actualReturnDate).map(sc => new Date(sc.expectedReturnDate).getTime()));
            return earliestA - earliestB;
        });
  }, [projects, sampleCheckouts]);

  const activePipelineProjects = useMemo(() => {
    // --- MODIFIED: Implemented custom status-based sorting ---
    const statusOrder = {
        [ProjectStatus.QUOTING]: 1,
        [ProjectStatus.ACCEPTED]: 2,
        [ProjectStatus.SCHEDULED]: 3,
    };

    return projects
        .filter(p => 
            p.status === ProjectStatus.QUOTING || 
            p.status === ProjectStatus.ACCEPTED ||
            p.status === ProjectStatus.SCHEDULED
        )
        .sort((a, b) => {
            const orderA = statusOrder[a.status as keyof typeof statusOrder];
            const orderB = statusOrder[b.status as keyof typeof statusOrder];

            if (orderA !== orderB) {
                return orderA - orderB; // Primary sort by status order
            }
            return safeDateSort(a, b); // Secondary sort by date
        });
  }, [projects]);

  const projectListGrid = useMemo(() => {
    if (filter === ProjectStatus.CANCELLED) {
        return projects.filter(p => p.status === ProjectStatus.CANCELLED).sort(safeDateSort);
    }
    if (filter === ProjectStatus.COMPLETED) {
        return projects.filter(p => p.status === ProjectStatus.COMPLETED).sort(safeDateSort);
    }
    
    const activeProjects = projects
        .filter(p => ![ProjectStatus.COMPLETED, ProjectStatus.CLOSED, ProjectStatus.CANCELLED].includes(p.status))
        .sort(safeDateSort);
    
    if (filter === 'All') return activeProjects;
    
    return activeProjects.filter(p => p.status === filter);
  }, [projects, filter]);
  
  const filterOptions: (ProjectStatus | 'All' | 'Recap')[] = [
    'Recap', 'All', ProjectStatus.NEW, ProjectStatus.SAMPLE_CHECKOUT, 
    ProjectStatus.AWAITING_DECISION, ProjectStatus.QUOTING, ProjectStatus.ACCEPTED, 
    ProjectStatus.SCHEDULED, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsCheckoutModalOpen(true)}
                className="bg-accent hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
                <PackagePlus size={18} />
                New Checkout
            </button>
            <Link to="/customers" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Add New Project
            </Link>
        </div>
      </div>
      
      <div>
          <div className="flex items-center space-x-2 mb-6 overflow-x-auto pb-2">
              <button 
                onClick={() => setIsFilterVisible(!isFilterVisible)} 
                className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <Filter className="w-5 h-5 text-text-secondary flex-shrink-0"/>
                <span className="text-text-secondary flex-shrink-0">Filter:</span>
              </button>
              
              {isFilterVisible && (
                <div className="flex space-x-2">
                  {filterOptions.map(option => (
                      <button 
                        key={option} 
                        onClick={() => setFilter(option)} 
                        className={`px-3 py-1 text-sm rounded-full transition-colors flex-shrink-0 ${filter === option ? 'bg-accent text-white' : 'bg-surface text-text-secondary hover:bg-gray-700'}`}
                      >
                          {option}
                      </button>
                  ))}
                </div>
              )}
          </div>

          {filter === 'Recap' ? (
            <div>
                <ProjectCarousel title="Samples Out - Next Due" projects={samplesOutProjects} />
                <ProjectCarousel title="Active Pipeline" projects={activePipelineProjects} />
            </div>
          ) : (
            <div>
                <h2 className="text-2xl font-semibold mb-4 text-text-primary">Projects: {filter}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projectListGrid.length > 0 ? (
                        projectListGrid.map(project => (
                            <ProjectCarousel title="" projects={[project]} />
                        ))
                    ) : (
                        <p className="text-text-secondary col-span-full text-center py-8">No projects match the filter "{filter}".</p>
                    )}
                </div>
            </div>
          )}
      </div>
      
      <QuickCheckoutModal 
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;