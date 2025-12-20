import React, { useState, useEffect, useMemo, useRef } from 'react'; // Added useMemo
import { Link } from 'react-router-dom';
import { useInstallers } from '../hooks/useInstallers';
import { Installer } from '../types';
// --- MODIFIED: Imported the Search icon ---
import { PlusCircle, User, Mail, Phone, Edit, Briefcase, Search, Layers, Box } from 'lucide-react';
import AddEditInstallerModal from '../components/AddEditInstallerModal'; // <-- NEW IMPORT // Renamed import alias

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
  // --- NEW: State for the search term ---
  const [searchTerm, setSearchTerm] = useState('');

  // --- NEW: Memoized list of filtered installers based on search term ---
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
    return <div>Loading installers...</div>;
  }

  return (
    <div>
      <div className="bg-surface p-6 rounded-lg shadow-md mb-6 border border-border">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-text-primary">Installers</h1>
          <button 
            onClick={openAddModal}
            className="flex items-center justify-center bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg transition-colors md:w-auto w-full shadow-md"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Add Installer
          </button>
        </div>

        {/* Search bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input
            type="text"
            placeholder="Search installers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* --- MODIFIED: Map over the new filteredInstallers list --- */}
        {filteredInstallers.map(installer => (
          <Link 
            to={`/installers/${installer.id}`} 
            key={installer.id} 
            className="relative block bg-surface p-6 rounded-lg shadow-md border border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {/* Installer card content remains the same */}
            <div className="flex items-center mb-4">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0"
                style={{ backgroundColor: installer.color || '#6b7280' }}
              >
                <User className="w-6 h-6 text-white"/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary truncate">{installer.installerName}</h2>
              </div>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p className="flex items-center"><Mail className="w-4 h-4 mr-2 shrink-0"/> <span className="truncate">{installer.contactEmail || 'N/A'}</span></p>
              <p className="flex items-center"><Phone className="w-4 h-4 mr-2 shrink-0"/> <span className="truncate">{installer.contactPhone || 'N/A'}</span></p>
            </div>
            
            <div className="border-t border-border my-4"></div>
            
            {/* Active Samples Section - Always Visible */}
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-text-secondary flex items-center mb-1">
                    <Layers className="w-4 h-4 mr-2" />
                    Active Samples
                </h3>
                <p className="text-xs text-text-primary ml-6">
                    {installer.activeSampleCount && installer.activeSampleCount > 0 
                        ? `${installer.activeSampleCount} items checked out` 
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
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-background"
              title="Edit Installer"
            >
              <Edit className="w-4 h-4" />
            </button>
          </Link>
        ))}

        {/* --- MODIFIED: Improved "no results" handling --- */}
        {installers.length === 0 && (
          <p className="text-text-secondary col-span-full text-center py-8">No installers have been added yet.</p>
        )}
        {installers.length > 0 && filteredInstallers.length === 0 && (
            <p className="text-text-secondary col-span-full text-center py-8">No installers match your search.</p>
        )}
      </div>

      {/* Use the reusable modal instead of hardcoded form */}
      <AddEditInstallerModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        installer={editingInstaller}
      />
    </div>
  );
};

export default InstallerList;