import React, { useState, useEffect } from 'react';
import { Brush, Save, Palette, Trash2, Building, Globe, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';
import * as preferenceService from '../services/preferenceService';
import LiveThemePreview from './LiveThemePreview';

// --- HELPER: Calculate Contrast (Black vs White) ---
const getContrastColor = (hexColor: string) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // Calculate YIQ ratio (brightness)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // Returns black for bright colors, white for dark colors
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

const BrandingSettingsSection: React.FC = () => {
    const { systemBranding, refreshBranding } = useData();
    const [companyName, setCompanyName] = useState('Subfloor'); 
    const [systemTimezone, setSystemTimezone] = useState('America/Los_Angeles');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [faviconFile, setFaviconFile] = useState<File | null>(null);
    const [primaryColor, setPrimaryColor] = useState('#2563eb');
    const [secondaryColor, setSecondaryColor] = useState('#4b5563');
    const [accentColor, setAccentColor] = useState('#0d9488');
    const [backgroundColor, setBackgroundColor] = useState('#111827');
    const [surfaceColor, setSurfaceColor] = useState('#1f2937');
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Status Colors (New M3 Support)
    const [errorColor, setErrorColor] = useState('#ef4444');
    const [warningColor, setWarningColor] = useState('#f59e0b');
    const [successColor, setSuccessColor] = useState('#10b981');
    
    // NEW: Store initial state for "Reset" functionality
    const [initialState, setInitialState] = useState<any>(null);
    
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
            // Capture initial state for Reset
            setInitialState({
                companyName: systemBranding.companyName,
                systemTimezone: systemBranding.systemTimezone,
                primaryColor: systemBranding.primaryColor,
                secondaryColor: systemBranding.secondaryColor,
                accentColor: systemBranding.accentColor,
                backgroundColor: systemBranding.backgroundColor,
                surfaceColor: systemBranding.surfaceColor,
                errorColor: systemBranding.errorColor || '#ef4444',
                warningColor: systemBranding.warningColor || '#f59e0b',
                successColor: systemBranding.successColor || '#10b981'
            });
            if (systemBranding.companyName) setCompanyName(systemBranding.companyName);
            if (systemBranding.systemTimezone) setSystemTimezone(systemBranding.systemTimezone);
            if (systemBranding.primaryColor) setPrimaryColor(systemBranding.primaryColor);
            if (systemBranding.secondaryColor) setSecondaryColor(systemBranding.secondaryColor);
            if (systemBranding.accentColor) setAccentColor(systemBranding.accentColor);
            if (systemBranding.backgroundColor) setBackgroundColor(systemBranding.backgroundColor);
            if (systemBranding.surfaceColor) setSurfaceColor(systemBranding.surfaceColor);
            if (systemBranding.errorColor) setErrorColor(systemBranding.errorColor);
            if (systemBranding.warningColor) setWarningColor(systemBranding.warningColor);
            if (systemBranding.successColor) setSuccessColor(systemBranding.successColor);
        }
    }, [systemBranding]);
    
    const handleReset = () => {
        if (!initialState) return;
        if (!window.confirm("Discard unsaved changes and reset to last saved state?")) return;
        
        setCompanyName(initialState.companyName || 'Subfloor');
        setSystemTimezone(initialState.systemTimezone || 'America/Los_Angeles');
        setPrimaryColor(initialState.primaryColor || '#2563eb');
        setSecondaryColor(initialState.secondaryColor || '#4b5563');
        setAccentColor(initialState.accentColor || '#0d9488');
        setBackgroundColor(initialState.backgroundColor || '#111827');
        setSurfaceColor(initialState.surfaceColor || '#1f2937');
        setErrorColor(initialState.errorColor || '#ef4444');
        setWarningColor(initialState.warningColor || '#f59e0b');
        setSuccessColor(initialState.successColor || '#10b981');
        toast.success("Reset to last saved settings.");
    };

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
        // Auto-calculate text on primary
        formData.append('onPrimary', getContrastColor(primaryColor));
        
        formData.append('secondaryColor', secondaryColor);
        formData.append('onSecondary', getContrastColor(secondaryColor));
        
        formData.append('accentColor', accentColor);
        formData.append('onAccent', getContrastColor(accentColor));

        formData.append('backgroundColor', backgroundColor);
        formData.append('surfaceColor', surfaceColor);

        // For Error/Warning/Success, we generally keep White text, but we can calculate it too if we want true M3
        formData.append('errorColor', errorColor);
        formData.append('warningColor', warningColor);
        formData.append('successColor', successColor);

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
        <section>
            <h2 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3">
                <Brush className="w-7 h-7 text-accent" />
                System Branding
            </h2>
            
            {/* Company Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-6 mb-8">
                {/* Company Name Input */}
                <div className="py-6 border-b border-outline/10 md:border-b-0 md:bg-surface-container-low md:p-6 md:rounded-xl md:border md:border-outline/10">
                    <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                        <Building className="w-5 h-5 text-secondary" /> Company Name
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">Appears in email footers and titles.</p>
                    <input 
                        type="text" 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-all placeholder:text-text-tertiary"
                        placeholder="e.g. Acme Flooring Co."
                    />
                </div>

                {/* System Timezone Input */}
                <div className="py-6 border-b border-outline/10 md:border-b-0 md:bg-surface-container-low md:p-6 md:rounded-xl md:border md:border-outline/10">
                    <h3 className="text-lg font-medium text-text-primary mb-2 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-secondary" /> System Timezone
                    </h3>
                    <p className="text-sm text-text-secondary mb-4">Used for all dates and scheduling.</p>
                    <select
                        value={systemTimezone}
                        onChange={(e) => setSystemTimezone(e.target.value)}
                        className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-all cursor-pointer"
                    >
                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                        <option value="America/Denver">Mountain Time (US & Canada)</option>
                        <option value="America/Chicago">Central Time (US & Canada)</option>
                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                        <option value="UTC">UTC (Universal)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8">
                {/* Logo Upload */}
                <div className="py-6 border-b border-outline/10 md:border-b-0 md:bg-surface-container-low md:p-6 md:rounded-xl md:border md:border-outline/10">
                    <h3 className="text-lg font-medium text-text-primary mb-2">Company Logo</h3>
                    <p className="text-sm text-text-secondary mb-4">Displayed in the top-left of the application sidebar. Transparent PNG recommended.</p>
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative h-32 w-full flex items-center justify-center bg-surface-container-highest rounded-lg border-2 border-dashed border-outline/20 group">
                            {logoPreview ? (
                                <>
                                    <img src={logoPreview} alt="New Logo Preview" className="max-h-24 max-w-full object-contain" />
                                    <span className="absolute top-2 right-2 bg-primary-container text-primary text-xs px-2 py-1 rounded-full font-bold">New</span>
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
                <div className="py-6 border-b border-outline/10 md:border-b-0 md:bg-surface-container-low md:p-6 md:rounded-xl md:border md:border-outline/10">
                    <h3 className="text-lg font-medium text-text-primary mb-2">Browser Favicon</h3>
                    <p className="text-sm text-text-secondary mb-4">Displayed in the browser tab. Square image (PNG or ICO) required.</p>
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative h-32 w-full flex items-center justify-center bg-surface-container-highest rounded-lg border-2 border-dashed border-outline/20 group">
                             {faviconPreview ? (
                                <>
                                    <img src={faviconPreview} alt="New Favicon Preview" className="w-16 h-16 object-contain" />
                                    <span className="absolute top-2 right-2 bg-primary-container text-primary text-xs px-2 py-1 rounded-full font-bold">New</span>
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
            <div className="mt-8 pt-6 border-t border-outline/10">
                <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-accent" />
                    Theme Colors
                </h3>
                
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    
                    {/* LEFT COL: CONTROLS */}
                    <div className="xl:col-span-5 space-y-6">
                        
                        {/* Group 1: Brand */}
                        <div className="grid grid-cols-1 gap-3">
                            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Brand Identity</h4>
                            <ColorInput label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
                            <ColorInput label="Secondary Color" value={secondaryColor} onChange={setSecondaryColor} />
                            <ColorInput label="Accent Color" value={accentColor} onChange={setAccentColor} />
                        </div>

                        <div className="border-t border-outline/10 my-4"></div>

                        {/* Group 2: Interface */}
                        <div className="grid grid-cols-1 gap-3">
                            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Interface Theme</h4>
                            <ColorInput label="Page Background" value={backgroundColor} onChange={setBackgroundColor} />
                            <ColorInput label="Card Surface" value={surfaceColor} onChange={setSurfaceColor} />
                        </div>

                        <div className="border-t border-outline/10 my-4"></div>

                        {/* Group 3: Status Colors (NEW) */}
                        <div className="grid grid-cols-1 gap-3">
                            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Status Colors</h4>
                            <ColorInput label="Success (Green)" value={successColor} onChange={setSuccessColor} />
                            <ColorInput label="Warning (Orange)" value={warningColor} onChange={setWarningColor} />
                            <ColorInput label="Error (Red)" value={errorColor} onChange={setErrorColor} />
                        </div>
                    </div>

                    {/* RIGHT COL: PREVIEW */}
                    <div className="xl:col-span-7">
                        <div className="sticky top-6">
                            <div className="flex justify-between items-end mb-2">
                                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Live Preview</h4>
                                <span className="text-[10px] text-text-secondary bg-surface-container-low border border-outline/10 px-3 py-1 rounded-full">Changes applied on Save</span>
                            </div>
                            
                            {/* Helper Legend */}
                            <div className="mb-4 text-xs text-text-secondary space-y-1">
                                <p>• <strong>Primary:</strong> Buttons, Active Tabs, Links</p>
                                <p>• <strong>Secondary:</strong> Borders, Lines, Inactive Icons</p>
                                <p>• <strong>Accent:</strong> Status Badges, Notification Dots</p>
                            </div>

                            <LiveThemePreview 
                                primary={primaryColor}
                                secondary={secondaryColor}
                                accent={accentColor}
                                background={backgroundColor}
                                surface={surfaceColor}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end border-t border-outline/10 pt-4">
                <button 
                    onClick={handleReset} 
                    className="flex items-center gap-2 text-text-secondary hover:text-text-primary font-medium py-2 px-6 rounded-full hover:bg-surface-container-highest mr-auto transition-colors"
                >
                    <RotateCcw size={16} /> Reset Changes
                </button>
                
                <button 
                    onClick={handleSave} 
                    disabled={isUploading}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-8 rounded-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <Save size={18} />
                    {isUploading ? 'Uploading...' : 'Save Branding'}
                </button>
            </div>
        </section>
    );
};

const ColorInput = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div className="py-3 border-b border-outline/10 md:border-b-0 md:bg-surface-container-low md:p-4 md:rounded-xl md:border md:border-outline/10 flex items-center justify-between group hover:border-primary/50 transition-colors md:shadow-sm">
        <label className="text-sm font-medium text-text-primary">{label}</label>
        <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary font-mono opacity-50 group-hover:opacity-100 transition-opacity">{value}</span>
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-surface shadow-sm ring-1 ring-outline/10 hover:ring-primary transition-all">
                <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute -top-4 -left-4 w-20 h-20 p-0 border-0 cursor-pointer" />
            </div>
        </div>
    </div>
);

export default BrandingSettingsSection;