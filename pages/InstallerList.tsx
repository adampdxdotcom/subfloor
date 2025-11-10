import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Installer } from '../types';
import { PlusCircle, User, Mail, Phone, Edit, Briefcase } from 'lucide-react';

const formatDateRange = (startDateStr: string, endDateStr: string): string => {
  // ... (no changes in this function)
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

const initialFormState: Omit<Installer, 'id' | 'jobs'> = {
  installerName: '',
  contactEmail: '',
  contactPhone: '',
  color: '#3b82f6',
};

const InstallerList: React.FC = () => {
  const { installers, addInstaller, updateInstaller, isLoading } = useData();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<Omit<Installer, 'id' | 'jobs'> | Installer>(initialFormState);
  const [editingInstaller, setEditingInstaller] = useState<Installer | null>(null);

  useEffect(() => {
    if (!isModalOpen) {
      setEditingInstaller(null);
      setFormState(initialFormState);
    }
  }, [isModalOpen]);

  const openAddModal = () => {
    setEditingInstaller(null);
    setFormState(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, installer: Installer) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingInstaller(installer);
    setFormState({ ...installer, color: installer.color || initialFormState.color });
    setIsModalOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!('installerName' in formState) || !formState.installerName) {
      alert('Installer Name is required.');
      return;
    }
    try {
      if (editingInstaller) {
        await updateInstaller(formState as Installer);
      } else {
        await addInstaller(formState as Omit<Installer, 'id' | 'jobs'>);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert(`Failed to ${editingInstaller ? 'update' : 'add'} installer. Please try again.`);
    }
  };

  if (isLoading) {
    return <div>Loading installers...</div>;
  }

  return (
    <div>
      {/* --- MODIFICATION: Header stacks on mobile --- */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-text-primary">Installers</h1>
        <button 
          onClick={openAddModal}
          className="flex items-center justify-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors md:w-auto w-full"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Add Installer
        </button>
      </div>

      {/* --- MODIFICATION: Grid is now responsive --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {installers.map(installer => (
          <Link 
            to={`/installers/${installer.id}`} 
            key={installer.id} 
            className="relative block bg-surface p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
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
            
            {installer.jobs && installer.jobs.length > 0 && (
              <>
                <div className="border-t border-border my-4"></div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-text-secondary flex items-center mb-2">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Scheduled Jobs
                  </h3>
                  {installer.jobs.map(job => (
                    <div key={job.projectId} className="text-xs text-text-secondary grid grid-cols-3 gap-2 items-center">
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
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-gray-700"
              title="Edit Installer"
            >
              <Edit className="w-4 h-4" />
            </button>
          </Link>
        ))}
        {installers.length === 0 && (
          <p className="text-text-secondary col-span-full text-center">No installers have been added yet.</p>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-text-primary">
              {editingInstaller ? 'Edit Installer' : 'Add New Installer'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <input type="text" name="installerName" placeholder="Installer Name / Company" value={formState.installerName} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                <input type="email" name="contactEmail" placeholder="Contact Email" value={formState.contactEmail || ''} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" />
                <input type="tel" name="contactPhone" placeholder="Contact Phone" value={formState.contactPhone || ''} onChange={handleFormChange} className="w-full p-2 bg-gray-800 border border-border rounded" />
                
                <div className="flex items-center justify-between">
                  <label htmlFor="color" className="text-text-secondary">Calendar Color</label>
                  {/* --- MODIFICATION: Added container div for better sizing --- */}
                  <div className="w-16 h-10 flex items-center justify-end">
                    <div className="relative w-10 h-10">
                      <input 
                        type="color" 
                        id="color"
                        name="color" 
                        value={formState.color || '#3b82f6'} 
                        onChange={handleFormChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div 
                          className="w-10 h-10 rounded-md border-2 border-border pointer-events-none" 
                          style={{ backgroundColor: formState.color || '#3b82f6' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-primary hover:bg-secondary rounded text-white">
                  {editingInstaller ? 'Save Changes' : 'Add Installer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallerList;