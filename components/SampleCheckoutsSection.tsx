import React, { useState, useMemo } from 'react';
import { Project, Sample, SampleCheckout } from '../types';
import { Check, Clock, X, Search, PlusCircle, Layers, Move } from 'lucide-react'; // <-- IMPORT Move
import { useData } from '../context/DataContext';
import AddSampleInlineModal from './AddSampleInlineModal';
import { toast } from 'react-hot-toast';

interface SampleCheckoutsSectionProps {
    project: Project;
    isModalOpen: boolean;
    onCloseModal: () => void;
}

const formatSampleName = (sample: Sample) => {
  const parts = [];
  if (sample.style) parts.push(sample.style);
  if (sample.color) parts.push(sample.color);
  if (parts.length === 0) return `Sample #${sample.id}`;
  return parts.join(' - ');
};

const SampleCheckoutsSection: React.FC<SampleCheckoutsSectionProps> = ({ project, isModalOpen, onCloseModal }) => {
    const { 
        samples, 
        sampleCheckouts,
        addSampleCheckout,
        updateSampleCheckout,
        extendSampleCheckout,
    } = useData();
    
    const [searchTerm, setSearchTerm] = useState(''); 
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null); 
    const [returnDate, setReturnDate] = useState('');
    const [isAddInlineModalOpen, setAddInlineModalOpen] = useState(false);

    const projectCheckouts = useMemo(() => {
        return sampleCheckouts
            .filter(sc => sc.projectId === project.id)
            .sort((a, b) => new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime());
    }, [sampleCheckouts, project.id]);
    
    const searchResults = useMemo(() => {
        if (searchTerm.length < 2) return [];
        const lowercasedTerm = searchTerm.toLowerCase();
        return samples.filter(s => 
            (s.style?.toLowerCase().includes(lowercasedTerm) || 
             s.color?.toLowerCase().includes(lowercasedTerm) || 
             s.manufacturerName?.toLowerCase().includes(lowercasedTerm))
        );
    }, [samples, searchTerm]); 
    
    const resetModalState = () => { 
        setSearchTerm(''); 
        setSelectedSample(null); 
        setReturnDate(''); 
    }; 
    
    const handleCloseMainModal = () => {
        resetModalState();
        onCloseModal();
    };

    const handleSelectSample = (sample: Sample) => {
        if (!sample.isAvailable) {
            toast.error(`"${formatSampleName(sample)}" is currently checked out.`);
            return;
        }
        setSelectedSample(sample);
        setSearchTerm(formatSampleName(sample));
    }; 
    
    const handleCheckoutSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!selectedSample || !returnDate) return; 
        try { 
            await addSampleCheckout({ 
                projectId: project.id, 
                sampleId: selectedSample.id, 
                expectedReturnDate: new Date(returnDate).toISOString(), 
            }); 
            handleCloseMainModal();
        } catch (error) { 
            console.error("Checkout failed", error);
            toast.error("Checkout failed.");
        } 
    }; 

    const handleReturn = async (checkout: SampleCheckout) => { 
        if(confirm(`Are you sure you want to return this sample?`)) { 
            try { await updateSampleCheckout(checkout); } 
            catch (error) { console.error("Return failed:", error); toast.error("Failed to return sample."); } 
        } 
    }; 
    
    const handleExtend = async (checkout: SampleCheckout) => {
        try { await extendSampleCheckout(checkout); } 
        catch (error) { console.error("Extend failed:", error); toast.error("Failed to extend checkout."); }
    };

    const handleSampleCreated = (newSample: Sample) => {
        handleSelectSample(newSample);
        setAddInlineModalOpen(false);
    };
    
    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
            <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-tertiary hover:text-text-primary transition-colors" size={20} />
                    <Layers className="w-6 h-6 text-accent" />
                    <h3 className="text-xl font-semibold text-text-primary">Sample Checkouts</h3>
                </div>
                <button 
                  onClick={() => onCloseModal()} // This button in ProjectDetail will set the modal state
                  className="bg-primary hover:bg-secondary text-white font-bold py-1 px-3 text-sm rounded-lg"
                >
                    Check Out
                </button>
            </div>

            <div className="p-4 overflow-y-auto flex-grow">
                <div className="space-y-3"> 
                    {projectCheckouts.map(checkout => { 
                        const sample = samples.find(s => s.id === checkout.sampleId); 
                        if (!sample) return null;
                        return ( 
                            <div key={checkout.id} className="bg-gray-800 p-3 rounded-md flex justify-between items-center"> 
                                <div>
                                    <p className="font-semibold text-text-primary">{formatSampleName(sample)}</p>
                                    <p className="text-xs text-text-secondary">Expected Return: {new Date(checkout.expectedReturnDate).toLocaleDateString()}</p>
                                </div> 
                                {checkout.actualReturnDate ? ( 
                                    <span className="text-sm text-green-400 flex items-center"><Check className="w-4 h-4 mr-1"/> Returned on {new Date(checkout.actualReturnDate).toLocaleDateString()}</span> 
                                ) : ( 
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleExtend(checkout)} className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded flex items-center gap-1"><Clock size={14} /> Extend</button>
                                        <button onClick={() => handleReturn(checkout)} className="text-sm bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded">Return</button> 
                                    </div>
                                )} 
                            </div> 
                        ); 
                    })} 
                    {projectCheckouts.length === 0 && <p className="text-text-secondary text-center py-4">No samples checked out for this project.</p>} 
                </div>
            </div>
            
            {isModalOpen && ( 
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"> 
                    <div className="bg-surface p-8 rounded-lg w-full max-w-md"> 
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Check Out Sample</h3> 
                            <button onClick={handleCloseMainModal}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCheckoutSubmit} className="space-y-4"> 
                            <div> 
                                <label className="text-sm font-medium text-text-secondary block mb-2">1. Find Sample</label> 
                                <div className="relative"> 
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input type="text" placeholder="Search by style, color, manufacturer..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedSample(null); }} className="w-full p-2 pl-10 bg-gray-800 border border-border rounded" /> 
                                    {searchTerm.length > 1 && !selectedSample && ( 
                                        <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-60 overflow-y-auto"> 
                                            {searchResults.map(sample => (
                                                <div key={sample.id} onClick={() => handleSelectSample(sample)} className={`p-2 ${sample.isAvailable ? 'hover:bg-accent cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                                                    <p className="font-semibold">{formatSampleName(sample)}</p>
                                                    <p className="text-xs text-text-secondary">{sample.manufacturerName}</p>
                                                    {!sample.isAvailable && sample.checkoutProjectName && (<p className="text-xs text-yellow-400 mt-1">Out to: {sample.checkoutProjectName}</p>)}
                                                </div> 
                                            ))} 
                                            {searchResults.length === 0 && ( 
                                                <button type="button" onClick={() => setAddInlineModalOpen(true)} className="w-full flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 text-accent font-semibold"><PlusCircle size={16} /> Add "{searchTerm}" as new</button>
                                            )} 
                                        </div> 
                                    )} 
                                </div> 
                            </div>  
                            <div> 
                                <label className="text-sm font-medium text-text-secondary block mb-2">2. Select Return Date</label> 
                                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full p-2 bg-gray-800 border-border rounded" required/> 
                            </div> 
                            <div className="flex justify-end space-x-2 pt-4 border-t border-border"> 
                                <button type="button" onClick={handleCloseMainModal} className="py-2 px-4 bg-gray-600 rounded">Cancel</button> 
                                <button type="submit" disabled={!selectedSample || !returnDate} className="py-2 px-4 bg-primary rounded disabled:bg-gray-500 disabled:cursor-not-allowed">Check Out Sample</button> 
                            </div> 
                        </form> 
                    </div> 
                </div> 
            )} 

            <AddSampleInlineModal
                isOpen={isAddInlineModalOpen}
                onClose={() => setAddInlineModalOpen(false)}
                onSampleCreated={handleSampleCreated}
                initialSearchTerm={searchTerm}
            />
        </div>
    ); 
};

export default SampleCheckoutsSection;