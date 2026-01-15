import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInstallers } from '../hooks/useInstallers';
import { Installer } from '../types';
import { PlusCircle, User, Mail, Phone, Edit, Briefcase, Search, Layers } from 'lucide-react';
import AddEditInstallerModal from '../components/AddEditInstallerModal';

const formatDateRange = (startDateStr: string, endDateStr: string): string => {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const startMonth = startDate.toLocaleString('default', { month: 'short' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  if (startDay === endDay) {
    return `${startMonth} ${startDay}`;
  }
  return `${startMonth} ${startDay} - ${endDay}`;
};

const InstallerList: React.FC = () => {
  const { data: installers = [], isLoading } = useInstallers();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstaller, setEditingInstaller] = useState<Installer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInstallers = useMemo(() => {
    if (!installers) return [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    return installers.filter(installer => {
      const nameMatch = (installer.installerName?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      const emailMatch = (installer.contactEmail?.toLowerCase() ?? '').includes(lowerCaseSearchTerm);
      return nameMatch || emailMatch;
    });
  }, [installers, searchTerm]);


  const openAddModal = () => {
    setEditingInstaller(null);
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, installer: Installer) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingInstaller(installer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
      setIsModalOpen(false);
      setEditingInstaller(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        Loading installers...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Controls - De-boxed MD3 Style */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
          <h1 className="text-4xl font-bold text-text-primary tracking-tight">Installers</h1>
          <button 
            onClick={openAddModal}
            className="flex items-center justify-center bg-primary hover:bg-primary-hover text-on-primary font-semibold py-3 px-6 rounded-full transition-all shadow-lg hover:shadow-xl md:w-auto w-full"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Add Installer
          </button>
      </div>

      {/* Floating Search Bar */}
      <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            placeholder="Search installers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-full text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow shadow-sm hover:shadow-md placeholder:text-text-tertiary"
          />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredInstallers.map(installer => (
          <Link 
            to={`/installers/${installer.id}`} 
            key={installer.id} 
            className="relative block bg-surface-container-high p-6 rounded-xl shadow-sm border border-outline/10 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
          >
            <div className="flex items-center mb-4">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 shadow-sm border-2 border-surface"
                style={{ backgroundColor: installer.color || '#6b7280' }}
              >
                <User className="w-6 h-6 text-white"/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary truncate">{installer.installerName}</h2>
              </div>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p className="flex items-center"><Mail className="w-4 h-4 mr-3 shrink-0 opacity-70"/> <span className="truncate">{installer.contactEmail || 'N/A'}</span></p>
              <p className="flex items-center"><Phone className="w-4 h-4 mr-3 shrink-0 opacity-70"/> <span className="truncate">{installer.contactPhone || 'N/A'}</span></p>
            </div>
            
            <div className="border-t border-outline/10 my-4"></div>
            
            {/* Active Samples Section */}
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-text-secondary flex items-center mb-1">
                    <Layers className="w-4 h-4 mr-2" />
                    Active Samples
                </h3>
                <p className="text-xs text-text-primary ml-6">
                    {installer.activeSampleCount && installer.activeSampleCount > 0 
                        ? <span className="font-bold text-primary">{installer.activeSampleCount} items checked out</span>
                        : 'No samples checked out'}
                </p>
            </div>
            
            {installer.jobs && installer.jobs.length > 0 && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-text-secondary flex items-center mb-2">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Scheduled Jobs
                  </h3>
                  {installer.jobs.map((job, idx) => (
                    <div key={`${job.projectId}-${idx}`} className="text-xs text-text-secondary grid grid-cols-3 gap-2 items-center">
                      <span className="col-span-1 truncate font-medium text-text-primary">{job.projectName}</span>
                      <span className="col-span-1 truncate text-center">({job.customerName || 'N/A'})</span>
                      <span className="col-span-1 truncate text-right">{formatDateRange(job.scheduledStartDate, job.scheduledEndDate)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <button 
              onClick={(e) => openEditModal(e, installer)}
              className="absolute top-4 right-4 text-text-secondary hover:text-primary p-2 rounded-full hover:bg-surface-container-highest transition-colors opacity-0 group-hover:opacity-100"
              title="Edit Installer"
            >
              <Edit className="w-4 h-4" />
            </button>
          </Link>
        ))}

        {installers.length === 0 && (
          <p className="text-text-secondary col-span-full text-center py-8">No installers have been added yet.</p>
        )}
        {installers.length > 0 && filteredInstallers.length === 0 && (
            <p className="text-text-secondary col-span-full text-center py-8">No installers match your search.</p>
        )}
      </div>

      <AddEditInstallerModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        installer={editingInstaller}
      />
    </div>
  );
};

export default InstallerList;