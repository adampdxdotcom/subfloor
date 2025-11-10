import React, { useState, useEffect, useMemo } from 'react';
import { Project, Sample, SampleCheckout } from '../types';
import { Check } from 'lucide-react';

interface SampleCheckoutsSectionProps {
    project: Project;
    projectCheckouts: SampleCheckout[];
    samples: Sample[];
    addSample: (sample: Omit<Sample, 'id' | 'isAvailable' | 'imageUrl' | 'checkoutProjectId' | 'checkoutProjectName' | 'checkoutCustomerName' | 'productUrl'>) => Promise<Sample>;
    addSampleCheckout: (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>) => Promise<void>;
    updateSampleCheckout: (checkout: SampleCheckout) => Promise<void>;
    isModalOpen: boolean;
    onCloseModal: () => void;
}

const SampleCheckoutsSection: React.FC<SampleCheckoutsSectionProps> = ({ project, projectCheckouts, samples, addSample, addSampleCheckout, updateSampleCheckout, isModalOpen, onCloseModal }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null); 
    const [searchTerm, setSearchTerm] = useState(''); 
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null); 
    const [returnDate, setReturnDate] = useState(''); 
    const [isAddingNew, setIsAddingNew] = useState(false); 
    const [newSampleForm, setNewSampleForm] = useState({ manufacturer: '', styleColor: '', sku: ''}); 
    
    const searchResults = useMemo(() => {
        if (!selectedType || !searchTerm) return [];
        const lowercasedTerm = searchTerm.toLowerCase();
        return samples.filter(s => s.type === selectedType && (s.styleColor.toLowerCase().includes(lowercasedTerm) || (s.manufacturer && s.manufacturer.toLowerCase().includes(lowercasedTerm))));
    }, [samples, selectedType, searchTerm]); 
    
    const resetModalState = () => { setSelectedType(null); setSearchTerm(''); setSelectedSample(null); setReturnDate(''); setIsAddingNew(false); setNewSampleForm({ manufacturer: '', styleColor: '', sku: ''}); }; 
    useEffect(() => { if (!isModalOpen) { resetModalState(); } }, [isModalOpen]);

    const handleSelectSample = (sample: Sample) => {
        if (sample.isAvailable) {
            setSelectedSample(sample);
            setSearchTerm(sample.styleColor);
        }
    }; 
    
    const handleShowAddNew = () => { setNewSampleForm({ manufacturer: '', styleColor: searchTerm, sku: '' }); setIsAddingNew(true); }; 
    const handleSaveNewSample = async (e: React.FormEvent) => { e.preventDefault(); if (!newSampleForm.styleColor || !selectedType) return; try { const newlyAddedSample = await addSample({ ...newSampleForm, type: selectedType as string }); setIsAddingNew(false); handleSelectSample(newlyAddedSample); } catch (error) { console.error("Failed to save new sample:", error); } }; 
    const handleCheckoutSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!selectedSample || !returnDate) return; try { await addSampleCheckout({ projectId: project.id, sampleId: selectedSample.id, expectedReturnDate: new Date(returnDate).toISOString(), }); onCloseModal(); } catch (error) { console.error("Checkout failed", error); } }; 
    const handleReturn = async (checkout: SampleCheckout) => { if(confirm("Are you sure you want to return this sample?")) { try { await updateSampleCheckout(checkout); } catch (error) { console.error("Return failed:", error); } } }; 
    const sampleTypes = ["LVP", "Carpet", "Tile", "Hardwood", "Catalog", "Other"];
    
    return ( 
        <div>
            <div className="space-y-3"> 
                {projectCheckouts.map(checkout => { 
                    const sample = samples.find(s => s.id === checkout.sampleId); 
                    return ( 
                        <div key={checkout.id} className="bg-gray-800 p-3 rounded-md flex justify-between items-center"> 
                            <div>
                                <p className="font-semibold text-text-primary">{sample?.styleColor}</p>
                                <p className="text-xs text-text-secondary">Expected Return: {new Date(checkout.expectedReturnDate).toLocaleDateString()}</p>
                            </div> 
                            {checkout.actualReturnDate ? ( <span className="text-sm text-green-400 flex items-center"><Check className="w-4 h-4 mr-1"/> Returned</span> ) : ( <button onClick={() => handleReturn(checkout)} className="text-sm bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded">Return</button> )} 
                        </div> 
                    ); 
                })} 
                {projectCheckouts.length === 0 && <p className="text-text-secondary text-center py-4">No samples checked out.</p>} 
            </div> 
            {isModalOpen && ( 
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"> 
                    <div className="bg-surface p-8 rounded-lg w-full max-w-md"> 
                        <h3 className="text-xl font-bold mb-4">Check Out New Sample</h3> 
                        {!isAddingNew && ( 
                            <form onSubmit={handleCheckoutSubmit}> 
                                <div className="space-y-4"> 
                                    <div> 
                                        <label className="text-sm font-medium text-text-secondary block mb-2">1. Select Sample Type</label> 
                                        <div className="flex flex-wrap gap-2"> 
                                            {sampleTypes.map(type => ( <button key={type} type="button" onClick={() => setSelectedType(type)} className={`px-3 py-1 text-sm rounded-full ${selectedType === type ? 'bg-accent text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{type}</button>))} 
                                        </div> 
                                    </div> 
                                    {selectedType && ( 
                                        <div> 
                                            <label className="text-sm font-medium text-text-secondary block mb-2">2. Find or Add Sample</label> 
                                            <div className="relative"> 
                                                <input type="text" placeholder={`Search for ${selectedType}...`} value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedSample(null); }} className="w-full p-2 bg-gray-800 border-border rounded" /> 
                                                {searchTerm && !selectedSample && ( 
                                                    <div className="absolute z-10 w-full bg-gray-900 border border-border rounded-b-md mt-1 max-h-60 overflow-y-auto"> 
                                                        {searchResults.map(sample => (
                                                            <div 
                                                                key={sample.id} 
                                                                onClick={() => handleSelectSample(sample)} 
                                                                className={`p-2 ${sample.isAvailable ? 'hover:bg-accent cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                                                            >
                                                                <p className="font-semibold">{sample.styleColor}</p>
                                                                <p className="text-xs text-text-secondary">{sample.manufacturer}</p>
                                                                {!sample.isAvailable && sample.checkoutProjectName && (
                                                                    <p className="text-xs text-yellow-400 mt-1">Checked out to: {sample.checkoutProjectName}</p>
                                                                )}
                                                            </div> 
                                                        ))} 
                                                        {searchResults.length === 0 && ( <div className="p-2 text-center text-text-secondary"> No results. <button type="button" onClick={handleShowAddNew} className="ml-2 text-accent font-semibold hover:underline">Add it?</button> </div> )} 
                                                    </div> 
                                                )} 
                                            </div> 
                                        </div> 
                                    )} 
                                    <div> 
                                        <label className="text-sm font-medium text-text-secondary block mb-2">3. Select Return Date</label> 
                                        <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full p-2 bg-gray-800 border-border rounded" required/> 
                                    </div> 
                                </div> 
                                <div className="flex justify-end space-x-2 mt-6"> 
                                    <button type="button" onClick={onCloseModal} className="py-2 px-4 bg-gray-600 rounded">Cancel</button> 
                                    <button type="submit" disabled={!selectedSample || !returnDate} className="py-2 px-4 bg-primary rounded disabled:bg-gray-500 disabled:cursor-not-allowed">Check Out</button> 
                                </div> 
                            </form> 
                        )} 
                        {isAddingNew && ( 
                            <form onSubmit={handleSaveNewSample}> 
                                <p className="text-sm text-text-secondary mb-2">Adding new <span className="font-bold text-accent">{selectedType}</span> sample.</p>
                                <div className="space-y-4"> 
                                    <input type="text" placeholder="Style/Color" value={newSampleForm.styleColor} onChange={(e) => setNewSampleForm({ ...newSampleForm, styleColor: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" required />
                                    <input type="text" placeholder="Manufacturer" value={newSampleForm.manufacturer || ''} onChange={(e) => setNewSampleForm({ ...newSampleForm, manufacturer: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" /> 
                                    <input type="text" placeholder="SKU (optional)" value={newSampleForm.sku || ''} onChange={(e) => setNewSampleForm({ ...newSampleForm, sku: e.target.value })} className="w-full p-2 bg-gray-800 border border-border rounded" /> 
                                </div> 
                                <div className="flex justify-end space-x-2 mt-6"> 
                                    <button type="button" onClick={() => setIsAddingNew(false)} className="py-2 px-4 bg-gray-600 rounded">Back</button> 
                                    <button type="submit" className="py-2 px-4 bg-primary rounded">Save Sample</button> 
                                </div> 
                            </form> 
                        )} 
                    </div> 
                </div> 
            )} 
        </div>
    ); 
};

export default SampleCheckoutsSection;