import React, { useEffect, useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PrintableCheckout } from './PrintableCheckout';
import { CheckoutItem } from './SampleSelector';
import { Customer, Project, Installer } from '../types';
import { Loader2 } from 'lucide-react';
import ModalPortal from './ModalPortal';

interface ReprintCheckoutModalProps {
    checkoutId: string | number | null; // ID of the checkout to reprint
    isOpen: boolean;
    onClose: () => void;
}

const ReprintCheckoutModal: React.FC<ReprintCheckoutModalProps> = ({ checkoutId, isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<{
        items: CheckoutItem[];
        recipient: { type: 'project' | 'customer' | 'installer', data: any } | null;
        returnDate: string;
        project: Project | null;
        customer: Customer | null;
    } | null>(null);

    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Checkout_Summary_Reprint',
        onAfterPrint: () => onClose(), // Auto-close after printing (or cancelling)
    });

    useEffect(() => {
        if (isOpen && checkoutId) {
            setLoading(true);
            setData(null);

            fetch(`/api/sample-checkouts/group/${checkoutId}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch checkout group");
                    return res.json();
                })
                .then(groupData => {
                    // Map API response to Component props
                    const items: CheckoutItem[] = groupData.items.map((item: any) => ({
                        variantId: item.variantId,
                        interestVariantId: item.interestVariantId,
                        productName: item.productName,
                        variantName: '', // Not strictly needed for print if we have interestName
                        interestName: item.interestName, // API returns this
                        manufacturerName: item.manufacturerName,
                        manufacturerId: item.manufacturerId,
                        sampleType: item.sampleType,
                        quantity: item.quantity,
                        // Extended Data
                        productId: item.productId,
                        productType: item.productType,
                        size: item.size,
                        unitCost: item.unitCost,
                        cartonSize: item.cartonSize,
                        uom: item.uom,
                        pricingUnit: item.pricingUnit,
                        productUrl: item.productLineUrl || item.productUrl, // Handle field name variation
                    }));

                    let project: Project | null = null;
                    let customer: Customer | null = null;

                    if (groupData.recipient?.type === 'project') {
                        project = groupData.recipient.data;
                        customer = {
                            id: project?.customerId,
                            fullName: (project as any).customerName || 'Unknown',
                            // ... other fields mocked if missing
                        } as any;
                    } else if (groupData.recipient?.type === 'customer') {
                        customer = groupData.recipient.data;
                    } else if (groupData.recipient?.type === 'installer') {
                        // Map installer to customer-like object for PrintableCheckout
                        customer = {
                            id: groupData.recipient.data.id,
                            fullName: groupData.recipient.data.installerName,
                            installerName: groupData.recipient.data.installerName, // Specific field for logic
                            email: groupData.recipient.data.email,
                            phoneNumber: groupData.recipient.data.phone
                        } as any;
                    }

                    setData({
                        items,
                        recipient: groupData.recipient,
                        returnDate: groupData.returnDate,
                        project,
                        customer
                    });
                })
                .catch(err => {
                    console.error(err);
                    onClose(); // Close on error
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, checkoutId]);

    // Auto-trigger print when data is ready
    useEffect(() => {
        if (!loading && data && printRef.current) {
            // Small timeout to ensure DOM render
            const timer = setTimeout(() => {
                handlePrint();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, data, handlePrint]);

    if (!isOpen) return null;

    return (
        <ModalPortal>
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
                {/* Visual Feedback for User */}
                <div className="bg-white p-6 rounded-xl flex flex-col items-center gap-4 shadow-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="font-semibold text-gray-700">Preparing print preview...</p>
                </div>

                {/* Hidden Printable Area */}
                <div ref={printRef} className="print-only">
                    {data && (
                        <PrintableCheckout 
                            customer={data.customer}
                            project={data.project}
                            checkoutItems={data.items}
                            returnDate={data.returnDate}
                        />
                    )}
                </div>
            </div>
        </ModalPortal>
    );
};

export default ReprintCheckoutModal;