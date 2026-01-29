import React, { useMemo, useState } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useSampleCheckouts } from '../hooks/useSampleCheckouts';
import { useMaterialOrders } from '../hooks/useMaterialOrders';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus, Product } from '../types';
import { Filter, PackagePlus } from 'lucide-react';
import QuickCheckoutModal from '../components/QuickCheckoutModal';
import ProjectCarousel from '../components/ProjectCarousel'; 
import OrderCarousel from '../components/OrderCarousel';
import SampleCarousel from '../components/SampleCarousel';
import SampleDetailModal from '../components/SampleDetailModal';
import { useData } from '../context/DataContext';

const Dashboard: React.FC = () => {
  const { data: projects = [] } = useProjects();
  const { data: sampleCheckouts = [] } = useSampleCheckouts();
  const { data: materialOrders = [] } = useMaterialOrders();
  const { samples } = useData(); 
  
  const [filter, setFilter] = useState<ProjectStatus | 'All' | 'Recap'>('Recap');
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  
  const [selectedSampleForModal, setSelectedSampleForModal] = useState<any>(null);
  
  const safeDateSort = (a: Project, b: Project) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
  };

  const activeCheckouts = useMemo(() => {
      return sampleCheckouts
          .filter(sc => !sc.actualReturnDate)
          .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime());
  }, [sampleCheckouts]);

  const upcomingOrders = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureWindow = new Date(today);
      futureWindow.setDate(today.getDate() + 5); 

      return materialOrders
          .filter(o => {
              if (o.status !== 'Ordered' && o.status !== 'Damage Replacement') return false;
              if (!o.etaDate) return false;

              const dateStr = o.etaDate.includes('T') ? o.etaDate.split('T')[0] : o.etaDate;
              const eta = new Date(`${dateStr}T00:00:00`);
              
              return eta <= futureWindow;
          })
          .sort((a, b) => {
              const dateStrA = a.etaDate! && a.etaDate.includes('T') ? a.etaDate.split('T')[0] : a.etaDate!;
              const dateStrB = b.etaDate! && b.etaDate.includes('T') ? b.etaDate.split('T')[0] : b.etaDate!;
              return new Date(dateStrA).getTime() - new Date(dateStrB).getTime();
          });
  }, [materialOrders]);

  const activePipelineProjects = useMemo(() => {
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
                return orderA - orderB;
            }
            return safeDateSort(a, b);
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

  const handleSampleClick = (product: Product) => {
      const sample = samples.find(s => s.id === parseInt(product.id as any) || s.sku === product.variants[0]?.sku);
      if (sample) setSelectedSampleForModal(sample);
  };

  return (
    <div className="space-y-6">
        {/* Header Section - De-boxed */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
            <h1 className="text-4xl font-bold text-text-primary tracking-tight">Dashboard</h1>
            <button 
                onClick={() => setIsCheckoutModalOpen(true)}
                className="bg-primary hover:bg-primary-hover text-on-primary font-semibold py-3 px-6 rounded-full transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
                <PackagePlus size={20} />
                New Checkout
            </button>
        </div>
        
        {/* Filter Chips - Floating Surface */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 px-1 no-scrollbar after:content-[''] after:min-w-[1rem]">
                <button 
                  onClick={() => setIsFilterVisible(!isFilterVisible)} 
                  className="flex items-center space-x-2 p-2 rounded-full hover:bg-surface-container-high transition-colors cursor-pointer mr-2 text-text-secondary"
                >
                  <Filter className="w-5 h-5 flex-shrink-0"/>
                </button>
                
                {isFilterVisible && (
                  <div className="flex space-x-2">
                    {filterOptions.map(option => (
                        <button 
                          key={option} 
                          onClick={() => setFilter(option)} 
                          className={`px-4 py-2 text-sm rounded-full transition-colors flex-shrink-0 font-medium border ${filter === option ? 'bg-primary-container text-on-primary-container border-transparent' : 'bg-surface text-text-secondary border-outline hover:bg-surface-container-high'}`}
                        >
                            {option}
                        </button>
                    ))}
                  </div>
                )}
        </div>
      
      <div>
          {filter === 'Recap' ? (
            <div>
                <SampleCarousel title="Active Sample Checkouts" checkouts={activeCheckouts} onItemClick={handleSampleClick} />
                <OrderCarousel title="Upcoming Deliveries (Next 5 Days)" orders={upcomingOrders} projects={projects} />
                <ProjectCarousel title="Active Pipeline" projects={activePipelineProjects} />
            </div>
          ) : (
            <div>
                <h2 className="text-2xl font-semibold mb-4 text-text-primary">Projects: {filter}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projectListGrid.length > 0 ? (
                        projectListGrid.map(project => {
                            const isCancelled = project.status === ProjectStatus.CANCELLED;
                            return (
                                <Link 
                                    to={`/projects/${project.id}`} 
                                    key={project.id}
                                    className={isCancelled ? "opacity-60 grayscale block" : "block"}
                                >
                                    <ProjectCarousel title="" projects={[project]} />
                                </Link>
                            );
                        })
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
      
      <SampleDetailModal 
        isOpen={!!selectedSampleForModal}
        onClose={() => setSelectedSampleForModal(null)}
        sample={selectedSampleForModal}
      />
    </div>
  );
};

export default Dashboard;