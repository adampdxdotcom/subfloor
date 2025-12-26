import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Briefcase, Layers, HardHat, ArrowRight } from 'lucide-react';
import { getEndpoint, getImageUrl } from '../utils/apiConfig';

// --- MODIFIED: SearchResult types for the new grouped structure ---
interface SearchResultItem {
    id: string | number;
    title: string;
    subtitle: string | null;
    path: string;
    image?: string | null;
}

interface GroupedSearchResults {
    customers: SearchResultItem[];
    installers: SearchResultItem[];
    projects: SearchResultItem[];
    samples: SearchResultItem[];
}

const getResultIcon = (type: keyof GroupedSearchResults) => {
    switch (type) {
        case 'customers': return <User className="w-6 h-6 text-gray-400" />;
        case 'projects': return <Briefcase className="w-6 h-6 text-gray-400" />;
        case 'installers': return <HardHat className="w-6 h-6 text-gray-400" />;
        case 'samples': return <Layers className="w-6 h-6 text-gray-400" />;
        default: return null;
    }
};

const getViewAllPath = (type: string, query: string) => {
    const encodedQuery = encodeURIComponent(query);
    switch (type) {
        case 'customers': return `/customers?search=${encodedQuery}`;
        case 'installers': return `/installers?search=${encodedQuery}`;
        case 'samples': return `/samples?search=${encodedQuery}`;
        case 'projects': return `/dashboard?search=${encodedQuery}`;
        default: return '#';
    }
};

const UniversalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GroupedSearchResults | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Debouncing logic
    useEffect(() => {
        if (query.length < 2) {
            setResults(null);
            setIsDropdownOpen(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(() => {
            fetch(getEndpoint(`/api/search?q=${query}`), { credentials: 'include' })
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

    const totalResults = results 
        ? Object.values(results).reduce((acc, val) => acc + (Array.isArray(val) ? val.length : 0), 0) 
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
                        className="w-full bg-background text-text-primary pl-10 pr-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                
                {isDropdownOpen && (
                    <div className="fixed inset-x-0 bottom-0 top-[72px] md:absolute md:top-full md:bottom-auto md:mt-2 w-full md:w-96 bg-surface md:rounded-lg shadow-lg border-t md:border border-border z-50 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span>Searching...</span>
                            </div>
                        ) : totalResults > 0 && results ? (
                            <div>
                                {Object.entries(results).map(([groupName, groupResults]) => {
                                    if (!Array.isArray(groupResults) || groupResults.length === 0) return null;
                                    
                                    const visibleResults = groupResults.slice(0, 3);
                                    const hasMore = groupResults.length > 3;

                                    return (
                                        <div key={groupName}>
                                            <h3 className="text-sm font-bold uppercase text-text-secondary px-4 pt-4 pb-2 border-b border-border bg-background/50">
                                                {groupName}
                                            </h3>
                                            <ul>
                                                {visibleResults.map((result) => (
                                                    <li key={`${groupName}-${result.id}`}>
                                                        {groupName === 'samples' ? (
                                                            <Link
                                                                to={`/samples?open=${result.id}`}
                                                                onClick={resetSearch}
                                                                className="flex items-center gap-4 p-5 md:p-3 hover:bg-background transition-colors border-b border-border/50"
                                                            >
                                                                {result.image ? (
                                                                    <div className="w-10 h-10 rounded-md bg-background border border-border shrink-0 overflow-hidden">
                                                                        <img src={getImageUrl(result.image)} alt={result.title} className="w-full h-full object-cover" />
                                                                    </div>
                                                                ) : (
                                                                    getResultIcon(groupName as keyof GroupedSearchResults)
                                                                )}
                                                                <div>
                                                                    <p className="font-bold text-lg md:text-base text-text-primary">{result.title}</p>
                                                                    {result.subtitle && <p className="text-sm md:text-xs text-text-secondary">{result.subtitle}</p>}
                                                                </div>
                                                            </Link>
                                                        ) : (
                                                            <Link 
                                                                to={result.path}
                                                                onClick={resetSearch}
                                                                className="flex items-center gap-4 p-5 md:p-3 hover:bg-background transition-colors border-b border-border/50"
                                                            >
                                                                {getResultIcon(groupName as keyof GroupedSearchResults)}
                                                                <div>
                                                                    <p className="font-bold text-lg md:text-base text-text-primary">{result.title}</p>
                                                                    {result.subtitle && <p className="text-sm md:text-xs text-text-secondary">{result.subtitle}</p>}
                                                                </div>
                                                            </Link>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                            {hasMore && (
                                                <Link
                                                    to={getViewAllPath(groupName, query)}
                                                    onClick={resetSearch}
                                                    className="flex items-center justify-center gap-2 p-3 text-sm font-bold text-primary hover:bg-background/50 transition-colors border-b border-border/50"
                                                >
                                                    View All {groupName} <ArrowRight className="w-4 h-4" />
                                                </Link>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-gray-400">No results found for "{query}".</div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default UniversalSearch;