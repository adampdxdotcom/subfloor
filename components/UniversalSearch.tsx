import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Briefcase, Layers, HardHat } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Sample } from '../types';
import SampleDetailModal from './SampleDetailModal';

// --- MODIFIED: SearchResult types for the new grouped structure ---
interface SearchResultItem {
    id: number;
    title: string;
    subtitle: string | null;
    path: string;
}

interface GroupedSearchResults {
    customers: SearchResultItem[];
    installers: SearchResultItem[];
    projects: SearchResultItem[];
    samples: SearchResultItem[];
}

const getResultIcon = (type: keyof GroupedSearchResults) => {
    switch (type) {
        case 'customers': return <User className="w-5 h-5 text-gray-400" />;
        case 'projects': return <Briefcase className="w-5 h-5 text-gray-400" />;
        case 'installers': return <HardHat className="w-5 h-5 text-gray-400" />;
        case 'samples': return <Layers className="w-5 h-5 text-gray-400" />;
        default: return null;
    }
};

const UniversalSearch: React.FC = () => {
    const { samples } = useData(); // Get all samples for the modal
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GroupedSearchResults | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // --- ADDED: State for the sample detail modal ---
    const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
    const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);

    // Debouncing logic
    useEffect(() => {
        if (query.length < 2) {
            setResults(null);
            setIsDropdownOpen(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(() => {
            fetch(`/api/search?q=${query}`)
                .then(res => res.json())
                .then((data: GroupedSearchResults) => {
                    setResults(data);
                    setIsDropdownOpen(true);
                })
                .catch(console.error)
                .finally(() => setIsLoading(false));
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const resetSearch = () => {
        setQuery('');
        setResults(null);
        setIsDropdownOpen(false);
    };

    const handleSampleResultClick = (resultItem: SearchResultItem) => {
        const sampleToShow = samples.find(s => s.id === resultItem.id);
        if (sampleToShow) {
            setSelectedSample(sampleToShow);
            setIsSampleModalOpen(true);
        }
        resetSearch();
    };

    const totalResults = results 
        ? Object.values(results).reduce((acc, val) => acc + val.length, 0) 
        : 0;

    return (
        <>
            <div className="relative w-full md:w-64" ref={searchContainerRef}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search anything..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => query.length > 1 && setIsDropdownOpen(true)}
                        className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                </div>
                
                {isDropdownOpen && (
                    <div className="absolute top-full mt-2 w-full md:w-96 bg-surface rounded-lg shadow-lg border border-border z-50 max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 text-center text-gray-400">Searching...</div>
                        ) : totalResults > 0 && results ? (
                            <div>
                                {Object.entries(results).map(([groupName, groupResults]) => (
                                    groupResults.length > 0 && (
                                        <div key={groupName}>
                                            <h3 className="text-xs font-bold uppercase text-text-secondary px-3 pt-3 pb-1 border-b border-border">
                                                {groupName}
                                            </h3>
                                            <ul>
                                                {groupResults.map((result) => (
                                                    <li key={`${groupName}-${result.id}`}>
                                                        {groupName === 'samples' ? (
                                                            <button
                                                                onClick={() => handleSampleResultClick(result)}
                                                                className="w-full flex items-center gap-4 p-3 hover:bg-gray-700 transition-colors text-left"
                                                            >
                                                                {getResultIcon(groupName as keyof GroupedSearchResults)}
                                                                <div>
                                                                    <p className="font-semibold text-text-primary">{result.title}</p>
                                                                    {result.subtitle && <p className="text-xs text-text-secondary">{result.subtitle}</p>}
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <Link 
                                                                to={result.path}
                                                                onClick={resetSearch}
                                                                className="flex items-center gap-4 p-3 hover:bg-gray-700 transition-colors"
                                                            >
                                                                {getResultIcon(groupName as keyof GroupedSearchResults)}
                                                                <div>
                                                                    <p className="font-semibold text-text-primary">{result.title}</p>
                                                                    {result.subtitle && <p className="text-xs text-text-secondary">{result.subtitle}</p>}
                                                                </div>
                                                            </Link>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-gray-400">No results found for "{query}".</div>
                        )}
                    </div>
                )}
            </div>

            {isSampleModalOpen && selectedSample && (
                <SampleDetailModal
                    isOpen={isSampleModalOpen}
                    onClose={() => setIsSampleModalOpen(false)}
                    sample={selectedSample}
                />
            )}
        </>
    );
};

export default UniversalSearch;