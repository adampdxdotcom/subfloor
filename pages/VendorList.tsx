import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Vendor } from '../types';
import AddEditVendorModal from '../components/AddEditVendorModal';
import { toast } from 'react-hot-toast';
import { Edit, Trash2, PlusCircle, Building, Truck } from 'lucide-react';

const VendorList: React.FC = () => {
    const { vendors, addVendor, updateVendor, deleteVendor: contextDeleteVendor } = useData();
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
    
    const handleDeleteVendor = async (vendorId: number) => {
        if (window.confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
            try {
                await contextDeleteVendor(vendorId);
                toast.success('Vendor deleted successfully.');
            } catch (error) {
                console.error('Failed to delete vendor:', error);
                toast.error((error as Error).message || 'Failed to delete vendor.');
            }
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-border pb-4">
                <h1 className="text-3xl font-bold text-text-primary">Vendor Directory</h1>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <input
                        type="text"
                        placeholder="Search vendors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="p-2 bg-gray-800 border-border rounded w-full md:w-auto"
                    />
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                        <PlusCircle size={20} />
                        Add Vendor
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVendors.map(vendor => (
                    <div key={vendor.id} className="bg-surface rounded-lg shadow-md border border-border p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start">
                                <h2 className="text-xl font-semibold text-text-primary mb-2">{vendor.name}</h2>
                                <div className="flex space-x-2">
                                    <button onClick={() => handleOpenModal(vendor)} className="p-1 text-text-secondary hover:text-white"><Edit size={16} /></button>
                                    <button onClick={() => handleDeleteVendor(vendor.id)} className="p-1 text-red-500 hover:text-red-400"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-text-secondary mb-4">
                                {vendor.isManufacturer && <span className="flex items-center gap-1.5"><Building size={14}/> Manufacturer</span>}
                                {vendor.isSupplier && <span className="flex items-center gap-1.5"><Truck size={14}/> Supplier</span>}
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
                    </div>
                ))}
            </div>

            {filteredVendors.length === 0 && (
                 <div className="text-center py-10">
                    <p className="text-text-secondary">No vendors found.</p>
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