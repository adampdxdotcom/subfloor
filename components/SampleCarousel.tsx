// components/SampleCarousel.tsx

import React from 'react';
import { Sample } from '../types';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Clock, Undo2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

// This is a dedicated card for the carousel, with actions built-in.
const SampleCarouselCard = ({ sample, onClick }: { sample: Sample, onClick: () => void }) => {
    const { sampleCheckouts, extendSampleCheckout, updateSampleCheckout } = useData();

    const handleExtend = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the modal from opening
        if (!sample.checkoutId) return toast.error("Could not find checkout record to extend.");
        const checkoutToExtend = sampleCheckouts.find(sc => sc.id === sample.checkoutId);
        if (checkoutToExtend) await extendSampleCheckout(checkoutToExtend);
    };

    const handleReturn = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the modal from opening
        if (confirm(`Are you sure you want to return "${sample.styleColor}"?`)) {
            const checkoutToReturn = sampleCheckouts.find(sc => sc.id === sample.checkoutId);
            if (checkoutToReturn) await updateSampleCheckout(checkoutToReturn);
        }
    };
    
    // Determine due date color
    let dueDateColor = 'text-yellow-400';
    let dueDateText = 'Checked Out';
    if (sample.checkoutExpectedReturnDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(sample.checkoutExpectedReturnDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) {
            dueDateColor = 'text-red-500 font-bold';
            dueDateText = 'OVERDUE';
        } else if (dueDate.getTime() === today.getTime()) {
            dueDateColor = 'text-orange-400 font-bold';
            dueDateText = 'Due Today';
        }
    }


    return (
        <div className="bg-surface rounded-lg shadow-md border border-border overflow-hidden group flex flex-col cursor-pointer w-80 flex-shrink-0" onClick={onClick}>
            <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-text-secondary">
                {sample.imageUrl ? (
                    <img src={sample.imageUrl} alt={sample.styleColor} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-sm">No Image</span>
                )}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-text-primary truncate" title={sample.styleColor}>{sample.styleColor}</h3>
                <p className="text-sm text-text-secondary truncate" title={sample.manufacturerName || ''}>{sample.manufacturerName || 'N/A'}</p>
                <div className="flex-grow" />
                <div className="mt-4 text-xs">
                    <div className={`${dueDateColor} mb-2`}>
                        <span className="font-bold block">{dueDateText}</span>
                        {sample.checkoutProjectName && sample.checkoutProjectId && (
                            <Link to={`/projects/${sample.checkoutProjectId}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                                to {sample.checkoutProjectName}
                            </Link>
                        )}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <button onClick={handleExtend} className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded flex items-center gap-1"><Clock size={12} /> Extend</button>
                        <button onClick={handleReturn} className="text-xs bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded flex items-center gap-1"><Undo2 size={12} /> Return</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const SampleCarousel = ({ title, samples, onSampleClick }: { title: string, samples: Sample[], onSampleClick: (sample: Sample) => void }) => {
    return (
        <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-text-primary">{title}</h2>
            {samples.length > 0 ? (
                <div className="flex gap-6 overflow-x-auto pb-4">
                    {samples.map(sample => (
                        <SampleCarouselCard key={sample.id} sample={sample} onClick={() => onSampleClick(sample)} />
                    ))}
                </div>
            ) : (
                <p className="text-text-secondary italic">No samples are currently checked out.</p>
            )}
        </div>
    );
};

export default SampleCarousel;