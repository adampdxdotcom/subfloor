import React, { useState, useMemo, useEffect } from 'react'; // Added useEffect
import { useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
// --- MODIFIED: Added Edit icon ---
import { Building, Truck, Phone, Mail, User, Search, Layers, X, Edit } from 'lucide-react';
import { Product, Vendor, PricingSettings } from '../types'; // Added PricingSettings
// --- REPLACED: SampleDetailModal with ProductDetailModal ---
import ProductDetailModal from '../components/ProductDetailModal';
// --- ADDED: Import the AddEditVendorModal ---
import AddEditVendorModal from '../components/AddEditVendorModal';
import { toast } from 'react-hot-toast';
import ProductCard from '../components/ProductCard'; // NEW
import * as preferenceService from '../services/preferenceService'; // NEW

const VendorDetail: React.FC = () => {
    const { vendorId } = useParams<{ vendorId: string }>();
    // --- MODIFIED: Destructure updateVendor for the modal ---
    const { vendors, products, isLoading, updateVendor } = useData();
    
    const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [productTypeFilter, setProductTypeFilter] = useState<string>('All');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    // --- ADDED: State to control the vendor edit modal ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        preferenceService.getPricingSettings().then(setPricingSettings).catch(console.error);
    }, []);

    const vendor = useMemo(() => 
        vendors.find(v => v.id === parseInt(vendorId || '')),
    [vendors, vendorId]);

    const vendorProducts = useMemo(() => {
        if (!vendor) return [];
        // Manufacturer products are filtered by manufacturer_id
        const manufProducts = products.filter(p => p.manufacturerId === vendor.id);
        // Products supplied by this vendor, but manufactured by others (optional display)
        const suppliedProducts = products.filter(p => p.supplierId === vendor.id && p.manufacturerId !== vendor.id);
        
        // For the VENDOR detail page, we primarily show what they manufacture,
        // but we could extend this later if needed. For now, stick to manufactured lines.
        return manufProducts;
    }, [vendor, products]);

    const filteredProducts = useMemo(() => {
        let filtered = vendorProducts;
        if (productTypeFilter !== 'All') {
            filtered = filtered.filter(p => p.productType === productTypeFilter);
        }
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(p => {
                // Check parent name, manufacturer, and variants (deep search)
                const nameMatch = p.name.toLowerCase().includes(lowercasedTerm);
                const variantMatch = p.variants.some(v => 
                    (v.name && v.name.toLowerCase().includes(lowercasedTerm)) ||
                    (v.sku && v.sku.toLowerCase().includes(lowercasedTerm))
                );
                return nameMatch || variantMatch;
            });
        }
        return filtered;
    }, [vendorProducts, productTypeFilter, searchTerm]);

    const availableProductTypes = useMemo(() => 
        [...new Set(vendorProducts.map(p => p.productType).filter(Boolean))].sort(), 
    [vendorProducts]);

    const handleProductClick = (product: Product) => {
        setSelectedProduct(product);
        setIsDetailModalOpen(true);
    };

    const handleCloseProductModal = () => {
        setSelectedProduct(null);
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
                        <h2 className="text-3xl font-bold text-text-primary mb-4 md:mb-0">Product Lines ({filteredProducts.length})</h2>
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
                        {filteredProducts.map(product => (
                            <ProductCard 
                                key={product.id} 
                                product={product} 
                                pricingSettings={pricingSettings}
                                onClick={handleProductClick} 
                            />
                        ))}
                    </div>
                    {filteredProducts.length === 0 && vendorProducts.length > 0 && (
                        <p className="text-center text-text-secondary py-8 col-span-full">No products match your current filters.</p>
                    )}
                    {vendorProducts.length === 0 && (
                        <p className="text-center text-text-secondary py-8 col-span-full">This manufacturer has no products in the library yet.</p>
                    )}
                </div>
            )}
            
            {isDetailModalOpen && selectedProduct && (
                <ProductDetailModal 
                    isOpen={isDetailModalOpen}
                    onClose={handleCloseProductModal}
                    product={selectedProduct}
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