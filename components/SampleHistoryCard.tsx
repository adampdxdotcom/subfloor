import React from 'react';
import { SampleCheckout } from '../types';
import { Layers, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { getImageUrl } from '../utils/apiConfig';

interface CustomerSampleCardProps {
    sample: SampleCheckout;
    onStartProject: (sample: SampleCheckout) => void;
}

const CustomerSampleCard: React.FC<CustomerSampleCardProps> = ({ sample, onStartProject }) => {
    // Logic to determine image and title
    const anySample = sample as any;
    const imageUrl = anySample.interestVariantThumbnail || anySample.productThumbnail;
    const title = anySample.interestVariantName 
        ? `${anySample.interestVariantName} (${anySample.productName})` 
        : (anySample.productName || `Sample #${sample.id}`);
    
    return (
        <div className="bg-surface-container-high p-4 rounded-xl shadow-sm border border-outline/10 flex gap-4 transition-all hover:shadow-md relative group">
            {/* Image */}
            <div className="w-20 h-20 bg-surface-container-low rounded-lg border border-outline/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                {imageUrl ? (
                    <img src={getImageUrl(imageUrl)} alt={title} className="w-full h-full object-cover" />
                ) : (
                    <Layers className="text-text-tertiary w-8 h-8" />
                )}
                {/* Sample Type Badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 truncate">
                    {sample.sampleType || 'Sample'}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                    <p className="font-bold text-text-primary text-sm line-clamp-2" title={title}>{title}</p>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-text-secondary">
                        <Calendar size={12} />
                        <span>{formatDate(sample.checkoutDate)}</span>
                    </div>
                </div>

                {/* Actions / Status */}
                <div className="mt-2">
                    {!sample.projectId ? (
                        <button 
                            onClick={(e) => { e.preventDefault(); onStartProject(sample); }}
                            className="text-xs font-bold text-on-primary bg-primary hover:bg-primary-hover px-4 py-2 rounded-full flex items-center gap-1 transition-colors shadow-sm"
                        >
                            Start Project <ArrowRight size={12} />
                        </button>
                    ) : (
                        <div className="flex items-center gap-1 text-xs text-success font-bold bg-success-container px-3 py-1 rounded-full w-fit">
                            <CheckCircle2 size={12} />
                            <span>Linked to Project</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerSampleCard;