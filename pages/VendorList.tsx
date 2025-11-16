import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Vendor } from '../types';
import AddEditVendorModal from '../components/AddEditVendorModal';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
// --- MODIFIED: Removed Edit and Trash2 as they are no longer used here ---
import { PlusCircle, Building, Truck, Search, Layers } from 'lucide-react';

const VendorList: React.FC = () => {
    const { vendors, addVendor, updateVendor } = useData(); // Removed deleteVendor as it's not called here
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [vendorToEdit, setVendorToEdit] = useState<Vendor | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredVendors = useMemo(() => {
        if (!searchTerm) return vendors;
        const lowercasedTerm = searchTerm.toLowerCase();
        return vendors.filter(v =>
            v.name.toLowerCase().includes(lowercasedTerm) ||
            (v.repName && v.repName.toLowerCase().includes(lowercasedTerm))
        );
    }, [vendors, searchTerm]);

    const handleOpenModal = (vendor?: Vendor) => {
        setVendorToEdit(vendor || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setVendorToEdit(null);
        setIsModalOpen(false);
    };

    const handleSaveVendor = async (vendorData: Omit<Vendor, 'id'> | Vendor) => {
        try {
            if ('id' in vendorData) {
                await updateVendor(vendorData);
                toast.success('Vendor updated successfully!');
            } else {
                await addVendor(vendorData);
                toast.success('Vendor added successfully!');
            }
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save vendor:', error);
            toast.error((error as Error).message || 'Failed to save vendor.');
        }
    };
    
    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-text-primary">Vendor Directory</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors mt-4 md:mt-0"
                >
                    <PlusCircle size={20} />
                    Add Vendor
                </button>
            </div>
            
            <div className="relative mb-8">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                    type="text"
                    placeholder="Search by vendor name or rep name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVendors.map(vendor => (
                    <Link to={`/vendors/${vendor.id}`} key={vendor.id} className="bg-surface rounded-lg shadow-md border border-border p-5 flex flex-col justify-between hover:border-accent transition-colors duration-200 group">
                        <div>
                            <div className="flex justify-between items-start">
                                <h2 className="text-xl font-semibold text-text-primary mb-2 group-hover:text-accent">{vendor.name}</h2>
                                {/* --- REMOVED: Edit and Delete buttons are gone from this view --- */}
                            </div>
                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary mb-4">
                                {(vendor.vendorType === 'Manufacturer' || vendor.vendorType === 'Both') && 
                                    <span className="flex items-center gap-1.5"><Building size={14}/> Manufacturer</span>}
                                {(vendor.vendorType === 'Supplier' || vendor.vendorType === 'Both') && 
                                    <span className="flex items-center gap-1.5"><Truck size={14}/> Supplier</span>}
                                
                                {(vendor.vendorType === 'Manufacturer' || vendor.vendorType === 'Both') && (
                                    <span className="flex items-center gap-1.5 bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full text-xs font-semibold">
                                        <Layers size={12} /> {vendor.sampleCount || 0} Samples
                                    </span>
                                )}
                            </div>
                            
                            <p className="text-sm text-text-secondary mb-1">{vendor.address}</p>
                            <p className="text-sm text-text-secondary">{vendor.phone}</p>
                            
                            {(vendor.repName || vendor.repPhone) && (
                                <div className="mt-4 pt-4 border-t border-border">
                                    <p className="font-semibold text-text-primary">{vendor.repName}</p>
                                    <p className="text-sm text-text-secondary">{vendor.repPhone}</p>
                                </div>
                            )}
                        </div>
                    </Link>
                ))}
            </div>

            {filteredVendors.length === 0 && (
                 <div className="text-center py-10 col-span-full">
                    <p className="text-text-secondary">{searchTerm ? 'No vendors match your search.' : 'No vendors found.'}</p>
                </div>
            )}
            
            <AddEditVendorModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveVendor}
                vendorToEdit={vendorToEdit}
            />
        </div>
    );
};

export default VendorList;