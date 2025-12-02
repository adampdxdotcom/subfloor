import React, { useState, useEffect } from 'react';
import { MaterialOrder, OrderLineItem } from '../types';
import { X, Truck, AlertTriangle, Mail, ArrowLeft, CheckCircle, Upload } from 'lucide-react';

interface ReceiveOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: MaterialOrder | null;
    onReceive: (orderId: number, data: { dateReceived: string; notes: string; sendEmailNotification: boolean; files: FileList | null }) => Promise<void>;
    onReportDamage: (orderId: number, data: { items: { sampleId: number; quantity: number; unit: string }[]; replacementEta: string; notes: string; sendEmailNotification: boolean; files: FileList | null }) => Promise<void>;
}

const ReceiveOrderModal: React.FC<ReceiveOrderModalProps> = ({ isOpen, onClose, order, onReceive, onReportDamage }) => {
    const [mode, setMode] = useState<'RECEIVE' | 'DAMAGE'>('RECEIVE');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Receive State
    const [dateReceived, setDateReceived] = useState('');
    const [notes, setNotes] = useState('');
    const [sendEmail, setSendEmail] = useState(true);
    const [files, setFiles] = useState<FileList | null>(null); // NEW: File State

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
            setFiles(null);
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
                sampleId: item.sampleId,
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
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
            <div className="bg-surface rounded-lg shadow-2xl w-full max-w-lg border border-border flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-background rounded-t-lg">
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
                <div className="p-6 overflow-y-auto">
                    
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
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Paperwork (Packing Slip / BOL)</label>
                                <div className="border-2 border-dashed border-border rounded-lg p-4 hover:bg-background transition-colors text-center cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        multiple 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => setFiles(e.target.files)}
                                    />
                                    <Upload className="w-6 h-6 text-text-tertiary mx-auto mb-1" />
                                    <span className="text-sm text-text-secondary">{files && files.length > 0 ? `${files.length} file(s) selected` : 'Click to upload documents'}</span>
                                </div>
                            </div>

                            {hasEmail && (
                                <div className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg mt-2">
                                    <div className="pt-0.5">
                                        <input 
                                            type="checkbox" 
                                            id="sendEmail"
                                            checked={sendEmail}
                                            onChange={e => setSendEmail(e.target.checked)}
                                            className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary"
                                        />
                                    </div>
                                    <label htmlFor="sendEmail" className="text-sm cursor-pointer">
                                        <span className="font-semibold text-text-primary flex items-center gap-2">
                                            <Mail size={14} /> Email Notification
                                        </span>
                                        <span className="block text-text-secondary mt-0.5">
                                            Send an email to <strong>{emailRecipient}</strong> confirming arrival.
                                        </span>
                                    </label>
                                </div>
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
                                <div className="border-2 border-dashed border-red-200 bg-red-50 hover:bg-red-100 rounded-lg p-4 transition-colors text-center cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        multiple 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => setFiles(e.target.files)}
                                    />
                                    <Upload className="w-6 h-6 text-red-400 mx-auto mb-1" />
                                    <span className="text-sm text-red-600">{files && files.length > 0 ? `${files.length} file(s) selected` : 'Upload photos of damage'}</span>
                                </div>
                            </div>

                            {hasEmail && (
                                <div className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg mt-2">
                                    <div className="pt-0.5">
                                        <input 
                                            type="checkbox" 
                                            id="sendDamageEmail"
                                            checked={sendEmail}
                                            onChange={e => setSendEmail(e.target.checked)}
                                            className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary"
                                        />
                                    </div>
                                    <label htmlFor="sendDamageEmail" className="text-sm cursor-pointer">
                                        <span className="font-semibold text-text-primary flex items-center gap-2">
                                            <Mail size={14} /> Send Damage Notification
                                        </span>
                                        <span className="block text-text-secondary mt-0.5">
                                            Email <strong>{emailRecipient}</strong> about the damage and new ETA.
                                        </span>
                                    </label>
                                </div>
                            )}
                        </form>
                    )}

                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-border bg-surface rounded-b-lg flex justify-end gap-3">
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
    );
};

export default ReceiveOrderModal;