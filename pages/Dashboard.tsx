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
import { useData } from '../context/DataContext'; // Need products to map back if needed, but carousel passes product

const Dashboard: React.FC = () => {
  const { data: projects = [] } = useProjects();
  const { data: sampleCheckouts = [] } = useSampleCheckouts();
  const { data: materialOrders = [] } = useMaterialOrders();
  const { samples } = useData(); // Get legacy samples for modal mapping
  
  const [filter, setFilter] = useState<ProjectStatus | 'All' | 'Recap'>('Recap');
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  
  // Sample Modal State
  const [selectedSampleForModal, setSelectedSampleForModal] = useState<any>(null); // Use any/legacy Sample type
  
  const safeDateSort = (a: Project, b: Project) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
  };

  // 1. ACTIVE SAMPLES
  const activeCheckouts = useMemo(() => {
      return sampleCheckouts
          .filter(sc => !sc.actualReturnDate)
          .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime());
  }, [sampleCheckouts]);

  // 2. UPCOMING ORDERS CAROUSEL (5 Days)
  const upcomingOrders = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureWindow = new Date(today);
      // Set window to exactly 5 days
      futureWindow.setDate(today.getDate() + 5); 

      return materialOrders
          .filter(o => {
              // Only show Active or Replacement orders
              if (o.status !== 'Ordered' && o.status !== 'Damage Replacement') return false;
              if (!o.etaDate) return false;

              // Robust Date Parsing (Fixes the missing order issue)
              const dateStr = o.etaDate.includes('T') ? o.etaDate.split('T')[0] : o.etaDate;
              const eta = new Date(`${dateStr}T00:00:00`);
              
              // Logic: Show everything in the past (overdue) AND everything up to 5 days in future
              return eta <= futureWindow;
          })
          .sort((a, b) => {
              // Robust Sort
              const dateStrA = a.etaDate! && a.etaDate.includes('T') ? a.etaDate.split('T')[0] : a.etaDate!;
              const dateStrB = b.etaDate! && b.etaDate.includes('T') ? b.etaDate.split('T')[0] : b.etaDate!;
              return new Date(dateStrA).getTime() - new Date(dateStrB).getTime();
          });
  }, [materialOrders]);

  // 3. ACTIVE PIPELINE CAROUSEL
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
      // Map Product back to legacy Sample format for the modal (temporary bridge)
      // Or better, update SampleDetailModal to take Product. 
      // For now, find the matching sample in context.
      const sample = samples.find(s => s.id === parseInt(product.id as any) || s.sku === product.variants[0]?.sku);
      if (sample) setSelectedSampleForModal(sample);
      // Fallback: If migration isn't 100% perfect, we might fail to open old samples via new product objects
  };

  return (
    <div>
      <div className="bg-surface p-6 rounded-lg shadow-md mb-6 border border-border">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
          <div className="flex flex-wrap items-center gap-4">
              <button 
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-md"
              >
                  <PackagePlus size={18} />
                  New Checkout
              </button>

          </div>
        </div>
        
        <div className="border-t border-border pt-4">
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar">
                <button 
                  onClick={() => setIsFilterVisible(!isFilterVisible)} 
                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-background transition-colors cursor-pointer mr-2"
                >
                  <Filter className="w-5 h-5 text-text-secondary flex-shrink-0"/>
                  <span className="text-text-secondary font-medium flex-shrink-0">Filter:</span>
                </button>
                
                {isFilterVisible && (
                  <div className="flex space-x-2">
                    {filterOptions.map(option => (
                        <button 
                          key={option} 
                          onClick={() => setFilter(option)} 
                          className={`px-3 py-1.5 text-sm rounded-full transition-colors flex-shrink-0 font-medium ${filter === option ? 'bg-primary text-on-primary shadow-sm' : 'bg-background text-text-secondary hover:bg-gray-700 border border-border'}`}
                        >
                            {option}
                        </button>
                    ))}
                  </div>
                )}
            </div>
        </div>
      </div>
      
      <div>
          {filter === 'Recap' ? (
            <div>
                <SampleCarousel title="Active Sample Checkouts" checkouts={activeCheckouts} onItemClick={handleSampleClick} />
                {/* This is the ONLY Order Carousel */}
                <OrderCarousel title="Upcoming Deliveries (Next 5 Days)" orders={upcomingOrders} projects={projects} />
                <ProjectCarousel title="Active Pipeline" projects={activePipelineProjects} />
            </div>
          ) : (
            <div>
                <h2 className="text-2xl font-semibold mb-4 text-text-primary">Projects: {filter}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projectListGrid.length > 0 ? (
                        projectListGrid.map(project => (
                            <Link to={`/projects/${project.id}`} key={project.id}>
                                <ProjectCarousel title="" projects={[project]} />
                            </Link>
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
      
      <SampleDetailModal 
        isOpen={!!selectedSampleForModal}
        onClose={() => setSelectedSampleForModal(null)}
        sample={selectedSampleForModal}
      />
    </div>
  );
};

export default Dashboard;