import React, { useState, useEffect } from 'react';
import { Brush, Save, Palette, Trash2, Building, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';
import * as preferenceService from '../services/preferenceService';

const BrandingSettingsSection: React.FC = () => {
    const { systemBranding, refreshBranding } = useData();
    const [companyName, setCompanyName] = useState('Subfloor'); // Default fallback
    const [systemTimezone, setSystemTimezone] = useState('America/Los_Angeles');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [faviconFile, setFaviconFile] = useState<File | null>(null);
    const [primaryColor, setPrimaryColor] = useState('#2563eb');
    const [secondaryColor, setSecondaryColor] = useState('#4b5563');
    const [accentColor, setAccentColor] = useState('#0d9488');
    const [backgroundColor, setBackgroundColor] = useState('#111827');
    const [surfaceColor, setSurfaceColor] = useState('#1f2937');
    const [textPrimaryColor, setTextPrimaryColor] = useState('#f9fafb');
    const [textSecondaryColor, setTextSecondaryColor] = useState('#d1d5db');
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const API_URL = "";

    // Cleanup object URLs
    useEffect(() => {
        return () => {
            if (logoPreview) URL.revokeObjectURL(logoPreview);
            if (faviconPreview) URL.revokeObjectURL(faviconPreview);
        };
    }, [logoPreview, faviconPreview]);

    useEffect(() => {
        if (systemBranding) {
            if (systemBranding.companyName) setCompanyName(systemBranding.companyName);
            if (systemBranding.systemTimezone) setSystemTimezone(systemBranding.systemTimezone);
            if (systemBranding.primaryColor) setPrimaryColor(systemBranding.primaryColor);
            if (systemBranding.secondaryColor) setSecondaryColor(systemBranding.secondaryColor);
            if (systemBranding.accentColor) setAccentColor(systemBranding.accentColor);
            if (systemBranding.backgroundColor) setBackgroundColor(systemBranding.backgroundColor);
            if (systemBranding.surfaceColor) setSurfaceColor(systemBranding.surfaceColor);
            if (systemBranding.textPrimaryColor) setTextPrimaryColor(systemBranding.textPrimaryColor);
            if (systemBranding.textSecondaryColor) setTextSecondaryColor(systemBranding.textSecondaryColor);
        }
    }, [systemBranding]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (type === 'logo' && logoPreview) URL.revokeObjectURL(logoPreview);
        if (type === 'favicon' && faviconPreview) URL.revokeObjectURL(faviconPreview);

        const previewUrl = URL.createObjectURL(file);
        if (type === 'logo') {
            setLogoFile(file);
            setLogoPreview(previewUrl);
        } else {
            setFaviconFile(file);
            setFaviconPreview(previewUrl);
        }
    };

    const handleDelete = async (type: 'logo' | 'favicon') => {
        if (!window.confirm(`Are you sure you want to remove the current ${type}?`)) return;
        try {
            await preferenceService.deleteSystemBranding(type);
            await refreshBranding();
            toast.success(`${type === 'logo' ? 'Company Logo' : 'Favicon'} removed.`);
            
            if (type === 'logo') {
                setLogoFile(null);
                if (logoPreview) URL.revokeObjectURL(logoPreview);
                setLogoPreview(null);
            } else {
                setFaviconFile(null);
                if (faviconPreview) URL.revokeObjectURL(faviconPreview);
                setFaviconPreview(null);
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to delete branding.");
        }
    };

    const handleSave = async () => {
        setIsUploading(true);
        const formData = new FormData();
        
        if (logoFile) formData.append('logo', logoFile);
        if (faviconFile) formData.append('favicon', faviconFile);
        
        formData.append('companyName', companyName);
        formData.append('systemTimezone', systemTimezone);
        formData.append('primaryColor', primaryColor);
        formData.append('secondaryColor', secondaryColor);
        formData.append('accentColor', accentColor);
        formData.append('backgroundColor', backgroundColor);
        formData.append('surfaceColor', surfaceColor);
        formData.append('textPrimaryColor', textPrimaryColor);
        formData.append('textSecondaryColor', textSecondaryColor);

        try {
            await preferenceService.uploadSystemBranding(formData);
            await refreshBranding();
            toast.success("Branding updated successfully!");
            
            setLogoFile(null);
            setFaviconFile(null);
            if (logoPreview) URL.revokeObjectURL(logoPreview);
            if (faviconPreview) URL.revokeObjectURL(faviconPreview);
            setLogoPreview(null);
            setFaviconPreview(null);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to upload branding.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
            <h2 className="text-2xl font-semibold text-text-primary mb-6 flex items-center gap-3">
                <Brush className="w-7 h-7 text-accent" />
                System Branding
            </h2>
            
            {/* Company Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Company Name Input */}
                <div className="bg-background p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                        <Building className="w-5 h-5 text-secondary" /> Company Name
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">Appears in email footers and titles.</p>
                    <input 
                        type="text" 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full p-3 bg-surface border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary outline-none transition-all"
                        placeholder="e.g. Acme Flooring Co."
                    />
                </div>

                {/* System Timezone Input */}
                <div className="bg-background p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-secondary" /> System Timezone
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">Used for all dates and scheduling.</p>
                    <select
                        value={systemTimezone}
                        onChange={(e) => setSystemTimezone(e.target.value)}
                        className="w-full p-3 bg-surface border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary outline-none transition-all"
                    >
                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                        <option value="America/Denver">Mountain Time (US & Canada)</option>
                        <option value="America/Chicago">Central Time (US & Canada)</option>
                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                        <option value="UTC">UTC (Universal)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Logo Upload */}
                <div className="bg-background p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-medium text-text-primary mb-2">Company Logo</h3>
                    <p className="text-sm text-text-secondary mb-4">Displayed in the top-left of the application sidebar. Transparent PNG recommended.</p>
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative h-32 w-full flex items-center justify-center bg-surface rounded border border-border border-dashed group">
                            {logoPreview ? (
                                <>
                                    <img src={logoPreview} alt="New Logo Preview" className="max-h-24 max-w-full object-contain" />
                                    <span className="absolute top-2 right-2 bg-accent text-on-accent text-xs px-2 py-1 rounded">New</span>
                                </>
                            ) : systemBranding?.logoUrl ? (
                                <>
                                    <img src={`${API_URL}${systemBranding.logoUrl}`} alt="Current Logo" className="max-h-24 max-w-full object-contain" />
                                    <button 
                                        onClick={() => handleDelete('logo')}
                                        className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded transition-opacity opacity-0 group-hover:opacity-100"
                                        title="Remove Logo"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            ) : (
                                <span className="text-text-secondary">No Logo Set</span>
                            )}
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleFileSelect(e, 'logo')} 
                            className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-on-primary hover:file:bg-primary-hover"
                        />
                    </div>
                </div>

                {/* Favicon Upload */}
                <div className="bg-background p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-medium text-text-primary mb-2">Browser Favicon</h3>
                    <p className="text-sm text-text-secondary mb-4">Displayed in the browser tab. Square image (PNG or ICO) required.</p>
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative h-32 w-full flex items-center justify-center bg-surface rounded border border-border border-dashed group">
                             {faviconPreview ? (
                                <>
                                    <img src={faviconPreview} alt="New Favicon Preview" className="w-16 h-16 object-contain" />
                                    <span className="absolute top-2 right-2 bg-accent text-on-accent text-xs px-2 py-1 rounded">New</span>
                                </>
                            ) : systemBranding?.faviconUrl ? (
                                <>
                                    <img src={`${API_URL}${systemBranding.faviconUrl}`} alt="Current Favicon" className="w-16 h-16 object-contain" />
                                    <button 
                                        onClick={() => handleDelete('favicon')}
                                        className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded transition-opacity opacity-0 group-hover:opacity-100"
                                        title="Remove Favicon"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            ) : (
                                <span className="text-text-secondary text-xs">None</span>
                            )}
                        </div>
                        <input 
                            type="file" 
                            accept=".ico,.png" 
                            onChange={(e) => handleFileSelect(e, 'favicon')} 
                            className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-on-primary hover:file:bg-primary-hover"
                        />
                    </div>
                </div>
            </div>

            {/* Color Palette Section */}
            <div className="mt-8 pt-6 border-t border-border">
                <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-accent" />
                    Theme Colors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-background p-4 rounded-lg border border-border flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">Primary Color</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary font-mono">{primaryColor}</span>
                            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-8 w-12 bg-transparent cursor-pointer rounded" />
                        </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border border-border flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">Secondary Color</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary font-mono">{secondaryColor}</span>
                            <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-8 w-12 bg-transparent cursor-pointer rounded" />
                        </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border border-border flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">Accent Color</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary font-mono">{accentColor}</span>
                            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-12 bg-transparent cursor-pointer rounded" />
                        </div>
                    </div>
                </div>
                
                <h4 className="text-sm font-medium text-text-primary mb-3">Base Theme (Advanced)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-background p-4 rounded-lg border border-border flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">Page Background</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary font-mono">{backgroundColor}</span>
                            <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-8 w-12 bg-transparent cursor-pointer rounded" />
                        </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border border-border flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">Surface (Cards)</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary font-mono">{surfaceColor}</span>
                            <input type="color" value={surfaceColor} onChange={(e) => setSurfaceColor(e.target.value)} className="h-8 w-12 bg-transparent cursor-pointer rounded" />
                        </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border border-border flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">Primary Text</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary font-mono">{textPrimaryColor}</span>
                            <input type="color" value={textPrimaryColor} onChange={(e) => setTextPrimaryColor(e.target.value)} className="h-8 w-12 bg-transparent cursor-pointer rounded" />
                        </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border border-border flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">Secondary Text</label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary font-mono">{textSecondaryColor}</span>
                            <input type="color" value={textSecondaryColor} onChange={(e) => setTextSecondaryColor(e.target.value)} className="h-8 w-12 bg-transparent cursor-pointer rounded" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end border-t border-border pt-4">
                <button 
                    onClick={handleSave} 
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={18} />
                    {isUploading ? 'Uploading...' : 'Save Branding'}
                </button>
            </div>
        </section>
    );
};

export default BrandingSettingsSection;