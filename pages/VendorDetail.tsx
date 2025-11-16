import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
// --- MODIFIED: Added Edit icon ---
import { Building, Truck, Phone, Mail, User, Search, Layers, X, Edit } from 'lucide-react';
import { Sample, Vendor } from '../types';
import SampleDetailModal from '../components/SampleDetailModal';
// --- ADDED: Import the AddEditVendorModal ---
import AddEditVendorModal from '../components/AddEditVendorModal';
import { toast } from 'react-hot-toast';

const formatSampleName = (sample: Sample) => {
    const parts = [];
    if (sample.line) parts.push(sample.line);
    if (sample.style) parts.push(sample.style);
    if (sample.color) parts.push(sample.color);
    if (parts.length === 0) return `Sample #${sample.id}`;
    return parts.join(' - ');
};

const VendorSampleCard = ({ sample, onClick }: { sample: Sample, onClick: () => void }) => {
    const displayName = formatSampleName(sample);
    return (
        <div onClick={onClick} className="bg-surface rounded-lg shadow-md border border-border overflow-hidden group flex flex-col cursor-pointer hover:border-accent transition-colors">
            <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-text-secondary">
                {sample.imageUrl ? (
                    <img src={sample.imageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-sm">No Image</span>
                )}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-text-primary truncate" title={displayName}>{displayName}</h3>
                <div className="flex-grow" />
                <div className="flex justify-between items-end mt-4 text-xs">
                    <span className="font-semibold bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{sample.productType || 'N/A'}</span>
                    {sample.isAvailable ? (
                        <span className="font-bold text-green-400">Available</span>
                    ) : (
                        <div className="text-right">
                            <span className="font-bold text-yellow-400">Checked Out</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const VendorDetail: React.FC = () => {
    const { vendorId } = useParams<{ vendorId: string }>();
    // --- MODIFIED: Destructure updateVendor for the modal ---
    const { vendors, samples, isLoading, updateVendor } = useData();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [productTypeFilter, setProductTypeFilter] = useState<string>('All');
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    // --- ADDED: State to control the vendor edit modal ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const vendor = useMemo(() => 
        vendors.find(v => v.id === parseInt(vendorId || '')),
    [vendors, vendorId]);

    const vendorSamples = useMemo(() => {
        if (!vendor) return [];
        return samples.filter(s => s.manufacturerId === vendor.id);
    }, [vendor, samples]);

    const filteredSamples = useMemo(() => {
        let filtered = vendorSamples;
        if (productTypeFilter !== 'All') {
            filtered = filtered.filter(s => s.productType === productTypeFilter);
        }
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(s => {
                const styleMatch = s.style && s.style.toLowerCase().includes(lowercasedTerm);
                const colorMatch = s.color && s.color.toLowerCase().includes(lowercasedTerm);
                const skuMatch = s.sku && s.sku.toLowerCase().includes(lowercasedTerm);
                return styleMatch || colorMatch || skuMatch;
            });
        }
        return filtered;
    }, [vendorSamples, productTypeFilter, searchTerm]);

    const availableProductTypes = useMemo(() => 
        [...new Set(vendorSamples.map(s => s.productType).filter(Boolean))].sort(), 
    [vendorSamples]);

    const handleSampleClick = (sample: Sample) => {
        setSelectedSample(sample);
        setIsDetailModalOpen(true);
    };

    const handleCloseSampleModal = () => {
        setSelectedSample(null);
        setIsDetailModalOpen(false);
    };

    // --- ADDED: Handler for saving the vendor modal ---
    const handleSaveVendor = async (vendorData: Vendor) => {
        try {
            await updateVendor(vendorData);
            toast.success('Vendor updated successfully!');
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Failed to save vendor:', error);
            toast.error((error as Error).message || 'Failed to save vendor.');
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading vendor details...</div>;
    }

    if (!vendor) {
        return <div className="text-center p-8">Vendor not found.</div>;
    }

    const isManufacturer = vendor.vendorType === 'Manufacturer' || vendor.vendorType === 'Both';
    const isSupplier = vendor.vendorType === 'Supplier' || vendor.vendorType === 'Both';

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-text-primary">{vendor.name}</h1>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-lg text-text-secondary mt-2">
                        {isManufacturer && <span className="flex items-center gap-2"><Building size={18}/> Manufacturer</span>}
                        {isSupplier && <span className="flex items-center gap-2"><Truck size={18}/> Supplier</span>}
                    </div>
                </div>
                {/* --- ADDED: Edit Vendor Button --- */}
                <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    <Edit size={18} />
                    Edit Vendor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <div className="bg-surface p-6 rounded-lg border border-border">
                    <h3 className="font-semibold text-xl mb-4 text-text-primary">Contact Information</h3>
                    <div className="space-y-3 text-text-secondary">
                        <p><strong className="text-text-primary">Address:</strong> {vendor.address || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Phone size={14}/> {vendor.phone || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Mail size={14}/> Ordering: {vendor.orderingEmail || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Mail size={14}/> Claims: {vendor.claimsEmail || 'N/A'}</p>
                    </div>
                </div>
                <div className="bg-surface p-6 rounded-lg border border-border">
                    <h3 className="font-semibold text-xl mb-4 text-text-primary">Sales Representative</h3>
                    <div className="space-y-3 text-text-secondary">
                        <p className="flex items-center gap-2"><User size={14}/> {vendor.repName || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Phone size={14}/> {vendor.repPhone || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Mail size={14}/> {vendor.repEmail || 'N/A'}</p>
                    </div>
                </div>
                 <div className="bg-surface p-6 rounded-lg border border-border">
                    <h3 className="font-semibold text-xl mb-4 text-text-primary">Other Details</h3>
                    <div className="space-y-3 text-text-secondary">
                        <p><strong className="text-text-primary">Shipping:</strong> {vendor.shippingMethod || 'N/A'}</p>
                        <p><strong className="text-text-primary">Notes:</strong> {vendor.notes || 'N/A'}</p>
                    </div>
                </div>
            </div>
            
            {isManufacturer && (
                <div>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-t border-border pt-8">
                        <h2 className="text-3xl font-bold text-text-primary mb-4 md:mb-0">Samples ({filteredSamples.length})</h2>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-1/2 -translate-y-1-2 text-text-secondary" />
                                <input
                                    type="text"
                                    placeholder="Search style or color..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-surface border border-border rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                            </div>
                            <select
                                value={productTypeFilter}
                                onChange={(e) => setProductTypeFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                                <option value="All">All Product Types</option>
                                {availableProductTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredSamples.map(sample => (
                            <VendorSampleCard key={sample.id} sample={sample} onClick={() => handleSampleClick(sample)} />
                        ))}
                    </div>
                    {filteredSamples.length === 0 && vendorSamples.length > 0 && (
                        <p className="text-center text-text-secondary py-8 col-span-full">No samples match your current filters.</p>
                    )}
                    {vendorSamples.length === 0 && (
                        <p className="text-center text-text-secondary py-8 col-span-full">This manufacturer has no samples in the library yet.</p>
                    )}
                </div>
            )}
            
            {isDetailModalOpen && selectedSample && (
                <SampleDetailModal 
                    isOpen={isDetailModalOpen}
                    onClose={handleCloseSampleModal}
                    sample={selectedSample}
                />
            )}

            {/* --- ADDED: The vendor edit modal, controlled by local state --- */}
            {isEditModalOpen && (
                <AddEditVendorModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveVendor}
                    vendorToEdit={vendor}
                />
            )}
        </div>
    );
};

export default VendorDetail;