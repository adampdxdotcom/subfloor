import React, { useState, useEffect } from 'react';
import { MaterialOrder, OrderLineItem } from '../types';
import { X, Truck, AlertTriangle, Mail, ArrowLeft, CheckCircle, Upload, MailX, Camera, FileText, Trash2, FolderOpen } from 'lucide-react';

interface ReceiveOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: MaterialOrder | null;
    onReceive: (orderId: number, data: { dateReceived: string; notes: string; sendEmailNotification: boolean; files: File[] }) => Promise<void>;
    onReportDamage: (orderId: number, data: { items: { sampleId: number; quantity: number; unit: string }[]; replacementEta: string; notes: string; sendEmailNotification: boolean; files: File[] }) => Promise<void>;
}

const ReceiveOrderModal: React.FC<ReceiveOrderModalProps> = ({ isOpen, onClose, order, onReceive, onReportDamage }) => {
    const [mode, setMode] = useState<'RECEIVE' | 'DAMAGE'>('RECEIVE');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Receive State
    const [dateReceived, setDateReceived] = useState('');
    const [notes, setNotes] = useState('');
    const [sendEmail, setSendEmail] = useState(true);
    const [files, setFiles] = useState<File[]>([]); // CHANGED: File Array

    // Damage State
    const [damageItems, setDamageItems] = useState<Set<number>>(new Set()); // ID of line items
    const [replacementEta, setReplacementEta] = useState('');
    const [damageNotes, setDamageNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMode('RECEIVE');
            setDateReceived(new Date().toISOString().split('T')[0]);
            setNotes('');
            setSendEmail(true);
            setDamageItems(new Set());
            setReplacementEta('');
            setDamageNotes('');
            setFiles([]);
            setIsSubmitting(false);
        }
    }, [isOpen, order]);

    if (!isOpen || !order) return null;

    // Determine email recipient for label
    const emailRecipient = order.purchaserType === 'Installer' 
        ? (order.installerEmail ? order.installerName : null)
        : (order.customerEmail ? order.customerName : null);
    
    const hasEmail = !!((order.purchaserType === 'Installer' && order.installerEmail) || (order.purchaserType === 'Customer' && order.customerEmail));

    const toggleDamageItem = (itemId: number) => {
        const next = new Set(damageItems);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        setDamageItems(next);
    };

    // NEW: Handle accumulating files
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Convert FileList to Array and append to existing files
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleReceiveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onReceive(order.id, { dateReceived, notes, sendEmailNotification: hasEmail && sendEmail, files });
            onClose();
        } catch (err) {
            console.error(err);
            setIsSubmitting(false);
        }
    };

    const handleDamageSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (damageItems.size === 0) return alert("Please select at least one damaged item.");
        
        setIsSubmitting(true);
        
        // Map selected line item IDs back to the minimal data needed for the re-order
        const itemsToReorder = order.lineItems
            .filter(item => damageItems.has(item.id))
            .map(item => ({
                sampleId: item.variantId, // Changed to variantId to match the new type
                quantity: item.quantity, // Default to full quantity, user can edit later if needed or we could add qty input here
                unit: item.unit || 'SF'
            }));

        try {
            await onReportDamage(order.id, {
                items: itemsToReorder,
                replacementEta,
                notes: damageNotes,
                sendEmailNotification: hasEmail && sendEmail,
                files // Pass the files
            });
            onClose();
        } catch (err) {
            console.error(err);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/75 z-50 overflow-y-auto">
            <div className="flex h-full items-center justify-center p-0 lg:p-4">
            <div className="bg-surface w-full h-full lg:h-auto lg:max-h-[90vh] lg:max-w-lg lg:rounded-lg shadow-2xl flex flex-col border border-border relative">
                
                {/* HEADER */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-background lg:rounded-t-lg sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        {mode === 'DAMAGE' ? (
                            <AlertTriangle className="text-text-primary w-6 h-6" />
                        ) : (
                            <Truck className="text-primary w-6 h-6" />
                        )}
                        <h2 className="text-xl font-bold text-text-primary">
                            {mode === 'DAMAGE' ? 'Report Damage' : 'Receive Order'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={24} />
                    </button>
                </div>

                {/* BODY */}
                <div className="p-6 overflow-y-auto flex-grow">
                    
                    {/* --- RECEIVE MODE --- */}
                    {mode === 'RECEIVE' && (
                        <form id="receive-form" onSubmit={handleReceiveSubmit} className="space-y-4">
                            <p className="text-sm text-text-secondary mb-4">
                                Mark this order as arrived. This will update the status to <strong>Received</strong>.
                            </p>
                            
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Date Received</label>
                                <input 
                                    type="date" 
                                    required
                                    value={dateReceived}
                                    onChange={e => setDateReceived(e.target.value)}
                                    className="w-full p-2 bg-background border border-border rounded text-text-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Notes (Optional)</label>
                                <textarea 
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="e.g. Left in garage, Box 2 looks slightly crushed..."
                                    className="w-full p-2 bg-background border border-border rounded text-text-primary h-24 resize-none"
                                />
                            </div>

                            {/* PAPERWORK UPLOAD */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Paperwork (Packing Slip / BOL)</label>
                                
                                {/* Split Action Buttons */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Standard Upload */}
                                    <label className="border border-border bg-surface hover:bg-background rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm">
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept=".pdf, .png, .jpg, .jpeg"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <FolderOpen className="w-6 h-6 text-primary mb-2" />
                                        <span className="text-xs font-bold text-text-primary">Upload Files</span>
                                    </label>

                                    {/* Camera Capture */}
                                    <label className="border border-border bg-surface hover:bg-background rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            capture="environment" 
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <Camera className="w-6 h-6 text-primary mb-2" />
                                        <span className="text-xs font-bold text-text-primary">Take Photo</span>
                                    </label>
                                </div>

                                {/* File Gallery / Preview */}
                                {files.length > 0 && (
                                    <div className="bg-background border border-border rounded-lg p-2 space-y-2">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-surface rounded shadow-sm">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {file.type.startsWith('image/') ? (
                                                        <img src={URL.createObjectURL(file)} alt="Preview" className="w-8 h-8 object-cover rounded" />
                                                    ) : (
                                                        <FileText className="w-8 h-8 text-text-tertiary" />
                                                    )}
                                                    <span className="text-xs font-medium truncate max-w-[150px] md:max-w-[200px]">{file.name}</span>
                                                </div>
                                                <button type="button" onClick={() => removeFile(idx)} className="text-text-tertiary hover:text-red-500"><X size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {hasEmail && (
                                <button
                                    type="button"
                                    onClick={() => setSendEmail(!sendEmail)}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-4 group ${
                                        sendEmail 
                                            ? 'border-primary bg-primary/10' 
                                            : 'border-border bg-background hover:bg-surface'
                                    }`}
                                >
                                    <div className={`p-2 rounded-full ${sendEmail ? 'bg-primary text-on-primary' : 'bg-secondary text-text-secondary'}`}>
                                        {sendEmail ? <Mail size={24} /> : <MailX size={24} />}
                                    </div>
                                    <div>
                                        <p className={`font-bold ${sendEmail ? 'text-primary' : 'text-text-secondary'}`}>
                                            {sendEmail ? 'Sending Email Notification' : 'Email Notification Disabled'}
                                        </p>
                                        <p className="text-sm text-text-secondary">
                                            {sendEmail ? `Will notify ${emailRecipient}` : `Click to enable notification for ${emailRecipient}`}
                                        </p>
                                    </div>
                                </button>
                            )}

                            <div className="pt-4 flex items-center justify-between">
                                <button 
                                    type="button"
                                    onClick={() => setMode('DAMAGE')}
                                    className="text-text-secondary hover:text-text-primary text-sm font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-background transition-colors"
                                >
                                    <AlertTriangle size={16} />
                                    Report Damage?
                                </button>
                            </div>
                        </form>
                    )}

                    {/* --- DAMAGE MODE --- */}
                    {mode === 'DAMAGE' && (
                        <form id="damage-form" onSubmit={handleDamageSubmit} className="space-y-4">
                            <div className="bg-background border border-border p-3 rounded text-sm text-text-secondary mb-4">
                                This will mark the current order as <strong>Received</strong> and create a new <strong>Replacement Order</strong> for the selected items.
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Which items are damaged?</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded p-2 bg-background">
                                    {order.lineItems.map(item => (
                                        <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-surface rounded cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={damageItems.has(item.id)}
                                                onChange={() => toggleDamageItem(item.id)}
                                                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                                            />
                                            <div className="text-sm">
                                                <span className="font-medium text-text-primary">
                                                    {item.quantity} {item.unit}
                                                </span>
                                                <span className="text-text-secondary mx-2">-</span>
                                                <span className="text-text-secondary">
                                                    {item.style} {item.color ? `(${item.color})` : ''}
                                                </span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Replacement ETA</label>
                                <input 
                                    type="date" 
                                    required
                                    value={replacementEta}
                                    onChange={e => setReplacementEta(e.target.value)}
                                    className="w-full p-2 bg-background border border-border rounded text-text-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Damage Notes</label>
                                <textarea 
                                    required
                                    value={damageNotes}
                                    onChange={e => setDamageNotes(e.target.value)}
                                    placeholder="Describe the damage..."
                                    className="w-full p-2 bg-background border border-border rounded text-text-primary h-20 resize-none"
                                />
                            </div>

                            {/* DAMAGE PHOTOS UPLOAD */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Damage Photos / Evidence</label>
                                
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    {/* Standard Upload */}
                                    <label className="border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm">
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept=".pdf, .png, .jpg, .jpeg"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <FolderOpen className="w-6 h-6 text-red-500 mb-2" />
                                        <span className="text-xs font-bold text-red-700">Upload Files</span>
                                    </label>

                                    {/* Camera Capture */}
                                    <label className="border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            capture="environment" 
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <Camera className="w-6 h-6 text-red-500 mb-2" />
                                        <span className="text-xs font-bold text-red-700">Take Photo</span>
                                    </label>
                                </div>

                                {/* File Gallery / Preview */}
                                {files.length > 0 && (
                                    <div className="bg-background border border-border rounded-lg p-2 space-y-2">
                                        {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-surface rounded shadow-sm border-l-2 border-red-400">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {file.type.startsWith('image/') ? (
                                                        <img src={URL.createObjectURL(file)} alt="Preview" className="w-8 h-8 object-cover rounded" />
                                                    ) : (
                                                        <FileText className="w-8 h-8 text-text-tertiary" />
                                                    )}
                                                    <span className="text-xs font-medium truncate max-w-[150px] md:max-w-[200px]">{file.name}</span>
                                                </div>
                                                <button type="button" onClick={() => removeFile(idx)} className="text-text-tertiary hover:text-red-500"><X size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {hasEmail && (
                                <button
                                    type="button"
                                    onClick={() => setSendEmail(!sendEmail)}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-4 group ${
                                        sendEmail 
                                            ? 'border-red-500 bg-red-50' 
                                            : 'border-border bg-background hover:bg-surface'
                                    }`}
                                >
                                    <div className={`p-2 rounded-full ${sendEmail ? 'bg-red-500 text-white' : 'bg-secondary text-text-secondary'}`}>
                                        {sendEmail ? <Mail size={24} /> : <MailX size={24} />}
                                    </div>
                                    <div>
                                        <p className={`font-bold ${sendEmail ? 'text-red-600' : 'text-text-secondary'}`}>
                                            {sendEmail ? 'Sending Damage Alert' : 'Alert Disabled'}
                                        </p>
                                        <p className="text-sm text-text-secondary">
                                            {sendEmail ? `Will notify ${emailRecipient}` : `Click to enable alert for ${emailRecipient}`}
                                        </p>
                                    </div>
                                </button>
                            )}
                        </form>
                    )}

                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-border bg-surface lg:rounded-b-lg flex justify-end gap-3 shrink-0 sticky bottom-0 z-10 lg:static">
                    {mode === 'DAMAGE' ? (
                        <>
                            <button 
                                type="button"
                                onClick={() => setMode('RECEIVE')}
                                className="px-4 py-2 text-text-secondary hover:text-text-primary flex items-center gap-2"
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button 
                                form="damage-form"
                                type="submit"
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded shadow-sm font-medium disabled:opacity-50"
                            >
                                {isSubmitting ? 'Processing...' : 'Submit Damage Report'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={onClose} 
                                type="button"
                                className="px-4 py-2 bg-secondary hover:bg-secondary-hover text-on-secondary rounded"
                            >
                                Cancel
                            </button>
                            <button 
                                form="receive-form"
                                type="submit"
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded shadow-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle size={18} />
                                {isSubmitting ? 'Receiving...' : 'Mark as Received'}
                            </button>
                        </>
                    )}
                </div>

            </div>
            </div>
        </div>
    );
};

export default ReceiveOrderModal;