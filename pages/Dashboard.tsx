import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus, SampleCheckout } from '../types';
import { ChevronRight, Filter, Bell, PackagePlus } from 'lucide-react';
import QuickCheckoutModal from '../components/QuickCheckoutModal';

const getStatusColor = (status: ProjectStatus): string => {
    // ... (no changes in this function)
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
    // ... (no changes in this function)
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
    // ... (no changes in this component)
    const { customers, sampleCheckouts } = useData();
    const customer = customers.find(c => c.id === project.customerId);
    const statusColor = getStatusColor(project.status);
    const overdueAlert = getOverdueAlert(project, sampleCheckouts);

    return (
        <Link to={`/projects/${project.id}`} className="block bg-surface p-4 rounded-lg shadow-md hover:shadow-lg hover:bg-gray-700 transition-all duration-300">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-text-primary">{project.projectName}</h3>
                    <p className="text-sm text-text-secondary">{customer?.fullName}</p>
                </div>
                <div className="flex items-center space-x-2">
                    {overdueAlert && (<div title={overdueAlert.text}><Bell className={`w-5 h-5 ${overdueAlert.color}`} /></div>)}
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor}`}>{project.status}</div>
                </div>
            </div>
            <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
                <span>{project.projectType}</span>
                <ChevronRight className="w-5 h-5 text-accent"/>
            </div>
        </Link>
    );
};

const Dashboard: React.FC = () => {
  const { projects } = useData();
  const [filter, setFilter] = useState<ProjectStatus | 'All'>('All');
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  const projectList = useMemo(() => {
    // ... (no changes in this useMemo hook)
    const safeDateSort = (a: Project, b: Project) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    };

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
  
  const filterOptions: (ProjectStatus | 'All')[] = [
    'All', ProjectStatus.NEW, ProjectStatus.SAMPLE_CHECKOUT, 
    ProjectStatus.AWAITING_DECISION, ProjectStatus.QUOTING, ProjectStatus.ACCEPTED, 
    ProjectStatus.SCHEDULED, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED
  ];

  return (
    <div>
      {/* --- MODIFICATION: Header now stacks on mobile --- */}
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
      
      <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-text-primary">Projects</h2>
          <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-2">
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

          {/* --- MODIFICATION: Project grid is now responsive --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectList.length > 0 ? (
                projectList.map(project => (
                    <ProjectCard key={project.id} project={project}/>
                ))
            ) : (
                <p className="text-text-secondary col-span-full text-center py-8">No projects match the filter "{filter}".</p>
            )}
          </div>
      </div>
      
      <QuickCheckoutModal 
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;