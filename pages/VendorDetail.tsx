import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Building, Truck, Phone, Mail, User, Search, X, Edit, Globe, Link as LinkIcon } from 'lucide-react';
import { Product, Vendor, PricingSettings } from '../types';
import ProductDetailModal from '../components/ProductDetailModal';
import AddEditVendorModal from '../components/AddEditVendorModal';
import { toast } from 'react-hot-toast';
import ProductCard from '../components/ProductCard';
import VendorCarousel from '../components/VendorCarousel';
import * as preferenceService from '../services/preferenceService';

const VendorDetail: React.FC = () => {
    const { vendorId } = useParams<{ vendorId: string }>();
    const { vendors, products, isLoading, updateVendor } = useData();
    
    const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [productTypeFilter, setProductTypeFilter] = useState<string>('All');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        preferenceService.getPricingSettings().then(setPricingSettings).catch(console.error);
    }, []);

    const vendor = useMemo(() => 
        vendors.find(v => v.id === parseInt(vendorId || '')),
    [vendors, vendorId]);

    const defaultSupplier = useMemo(() => vendor?.defaultSupplierId ? vendors.find(v => v.id === vendor.defaultSupplierId) : null, [vendor, vendors]);

    const suppliedManufacturers = useMemo(() => vendors.filter(v => v.defaultSupplierId === vendor?.id), [vendor, vendors]);

    const vendorProducts = useMemo(() => {
        if (!vendor) return [];
        return products.filter(p => p.manufacturerId === vendor.id);
    }, [vendor, products]);

    const filteredProducts = useMemo(() => {
        let filtered = vendorProducts;
        if (productTypeFilter !== 'All') {
            filtered = filtered.filter(p => p.productType === productTypeFilter);
        }
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(p => {
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
        return <div className="text-center p-8 text-text-secondary">Loading vendor details...</div>;
    }

    if (!vendor) {
        return <div className="text-center p-8 text-text-secondary">Vendor not found.</div>;
    }

    const isManufacturer = vendor.vendorType === 'Manufacturer' || vendor.vendorType === 'Both';
    const isSupplier = vendor.vendorType === 'Supplier' || vendor.vendorType === 'Both';

    return (
        <div className="container mx-auto space-y-8">
            {/* HEADER CARD - MD3 Style */}
            <div className="bg-surface-container-high p-8 rounded-xl shadow-sm border border-outline/10">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary">{vendor.name}</h1>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary mt-2 font-medium">
                            {isManufacturer && <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline/10"><Building size={14}/> Manufacturer</span>}
                            {isSupplier && <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline/10"><Truck size={14}/> Supplier</span>}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center gap-2 bg-primary-container hover:bg-primary text-primary hover:text-on-primary font-semibold py-2 px-6 rounded-full transition-all shadow-sm"
                    >
                        <Edit size={18} />
                        Edit Vendor
                    </button>
                </div>
            </div>
            
            {isSupplier && suppliedManufacturers.length > 0 && (
                <VendorCarousel title="Supplied Manufacturers" vendors={suppliedManufacturers} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <div className="bg-surface-container-high p-6 rounded-xl border border-outline/10 shadow-sm">
                    <h3 className="font-semibold text-xl mb-4 text-text-primary">Contact Information</h3>
                    <div className="space-y-3 text-text-secondary">
                        <p><strong className="text-text-primary">Address:</strong> {vendor.address || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Phone size={14}/> {vendor.phone || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Mail size={14}/> Ordering: {vendor.orderingEmail || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Mail size={14}/> Claims: {vendor.claimsEmail || 'N/A'}</p>
                        
                        {(vendor.websiteUrl || vendor.portalUrl) && (
                            <div className="pt-2 mt-2 border-t border-outline/10 space-y-2">
                                {vendor.websiteUrl && (
                                    <a href={vendor.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline font-medium"><Globe size={14}/> Website</a>
                                )}
                                {vendor.portalUrl && (
                                    <a href={vendor.portalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline font-medium"><LinkIcon size={14}/> Dealer Portal</a>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-surface-container-high p-6 rounded-xl border border-outline/10 shadow-sm">
                    <h3 className="font-semibold text-xl mb-4 text-text-primary">Sales Representative</h3>
                    <div className="space-y-3 text-text-secondary">
                        <p className="flex items-center gap-2"><User size={14}/> {vendor.repName || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Phone size={14}/> {vendor.repPhone || 'N/A'}</p>
                        <p className="flex items-center gap-2"><Mail size={14}/> {vendor.repEmail || 'N/A'}</p>
                    </div>
                </div>

                <div className="bg-surface-container-high p-6 rounded-xl border border-outline/10 shadow-sm">
                    <h3 className="font-semibold text-xl mb-4 text-text-primary">Other Details</h3>
                    <div className="space-y-3 text-text-secondary">
                        <p><strong className="text-text-primary">Shipping:</strong> {vendor.shippingMethod || 'N/A'}</p>
                        
                        {defaultSupplier && (
                            <div className="mt-2 p-4 bg-surface-container-low border border-outline/5 rounded-lg">
                                <p className="text-xs text-text-tertiary uppercase font-bold mb-1">Fulfilled By</p>
                                <p className="text-text-primary font-bold">{defaultSupplier.name}</p>
                                {defaultSupplier.phone && <p className="text-sm flex items-center gap-1 mt-1"><Phone size={12}/> {defaultSupplier.phone}</p>}
                                {defaultSupplier.orderingEmail && <p className="text-sm flex items-center gap-1"><Mail size={12}/> {defaultSupplier.orderingEmail}</p>}
                            </div>
                        )}
                        
                        <p><strong className="text-text-primary">Notes:</strong> {vendor.notes || 'N/A'}</p>
                    </div>
                </div>
            </div>
            
            {isManufacturer && (
                <div>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-t border-outline/10 pt-8">
                        <h2 className="text-3xl font-bold text-text-primary mb-4 md:mb-0">Product Lines ({filteredProducts.length})</h2>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="relative flex-grow min-w-[300px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search style or color..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-surface-container-high border-none rounded-full py-3 pl-12 pr-6 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                                />
                            </div>
                            <select
                                value={productTypeFilter}
                                onChange={(e) => setProductTypeFilter(e.target.value)}
                                className="bg-surface-container-high border-none rounded-full py-3 px-6 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm text-text-primary font-medium cursor-pointer"
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
                </div>
            )}
            
            {isDetailModalOpen && selectedProduct && (
                <ProductDetailModal 
                    isOpen={isDetailModalOpen}
                    onClose={handleCloseProductModal}
                    product={selectedProduct}
                />
            )}

            {isEditModalOpen && vendor && (
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