import React, { useState, useMemo } from 'react';
import { useVendors, useVendorMutations } from '../hooks/useVendors';
import { Vendor } from '../types';
import AddEditVendorModal from '../components/AddEditVendorModal';
import { toast } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Building, Truck, Search, Layers, Globe, Link as LinkIcon } from 'lucide-react';
import { useData } from '../context/DataContext';

const VendorList: React.FC = () => {
    const { data: vendors = [] } = useVendors(); 
    const { vendors: allVendors } = useData();
    const vendorMutations = useVendorMutations();
    const navigate = useNavigate();
    
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
                const { id, ...data } = vendorData;
                await vendorMutations.updateVendor.mutateAsync({ id, data });
                toast.success('Vendor updated successfully!');
            } else {
                await vendorMutations.addVendor.mutateAsync(vendorData as Omit<Vendor, 'id'>);
                toast.success('Vendor added successfully!');
            }
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save vendor:', error);
            toast.error((error as Error).message || 'Failed to save vendor.');
        }
    };
    
    return (
        <div className="container mx-auto">
            {/* Header & Controls - De-boxed MD3 Style */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 mb-8">
                <h1 className="text-4xl font-bold text-text-primary tracking-tight">Vendor Directory</h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-on-primary font-semibold py-3 px-6 rounded-full transition-all shadow-lg hover:shadow-xl"
                >
                    <PlusCircle size={20} />
                    Add Vendor
                </button>
            </div>
            
            {/* Floating Search Bar */}
            <div className="relative w-full max-w-2xl mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                    type="text"
                    placeholder="Search by vendor name or rep name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-full text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow shadow-sm hover:shadow-md placeholder:text-text-tertiary"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVendors.map(vendor => (
                    <div 
                        key={vendor.id} 
                        onClick={() => navigate(`/vendors/${vendor.id}`)}
                        className="bg-surface-container-high rounded-xl shadow-sm border border-outline/10 p-6 flex flex-col justify-between hover:shadow-md transition-all duration-200 group cursor-pointer"
                    >
                        <div>
                            <div className="flex justify-between items-start">
                                <h2 className="text-xl font-bold text-text-primary mb-2 group-hover:text-primary truncate flex-1 pr-2 transition-colors">{vendor.name}</h2>
                                <div className="flex gap-1">
                                    {vendor.portalUrl && (
                                        <a 
                                            href={vendor.portalUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            onClick={(e) => e.stopPropagation()} 
                                            className="p-1.5 text-text-tertiary hover:text-primary hover:bg-primary-container rounded-full transition-colors"
                                            title="Open Dealer Portal"
                                        >
                                            <LinkIcon size={16} />
                                        </a>
                                    )}
                                    {vendor.websiteUrl && (
                                        <a 
                                            href={vendor.websiteUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            onClick={(e) => e.stopPropagation()} 
                                            className="p-1.5 text-text-tertiary hover:text-primary hover:bg-primary-container rounded-full transition-colors"
                                            title="Open Website"
                                        >
                                            <Globe size={16} />
                                        </a>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center flex-wrap gap-2 text-sm text-text-secondary mb-5">
                                {(vendor.vendorType === 'Manufacturer' || vendor.vendorType === 'Both') && 
                                    <span className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded-md border border-outline/10"><Building size={14}/> Manufacturer</span>}
                                {(vendor.vendorType === 'Supplier' || vendor.vendorType === 'Both') && 
                                    <span className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded-md border border-outline/10"><Truck size={14}/> Supplier</span>}
                                
                                {(vendor.vendorType === 'Manufacturer' || vendor.vendorType === 'Both') && (
                                    <span className="flex items-center gap-1.5 bg-primary-container text-primary px-2 py-0.5 rounded-full text-xs font-bold ml-auto">
                                        <Layers size={12} /> {vendor.sampleCount || 0} Samples
                                    </span>
                                )}
                            </div>

                            {vendor.defaultSupplierId && (
                                <div className="mb-4 text-sm text-text-secondary bg-surface-container-low p-3 rounded-lg border border-outline/5">
                                    Distributor: <span className="font-medium text-text-primary">{allVendors.find(v => v.id === vendor.defaultSupplierId)?.name}</span>
                                </div>
                            )}
                            
                            <p className="text-sm text-text-secondary mb-1">{vendor.address}</p>
                            <p className="text-sm text-text-secondary">{vendor.phone}</p>
                            
                            {(vendor.repName || vendor.repPhone) && (
                                <div className="mt-4 pt-4 border-t border-outline/10">
                                    <p className="font-semibold text-text-primary">{vendor.repName}</p>
                                    <p className="text-sm text-text-secondary">{vendor.repPhone}</p>
                                </div>
                            )}
                        </div>
                    </div>
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