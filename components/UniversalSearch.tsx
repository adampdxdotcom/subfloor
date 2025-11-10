import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Briefcase, Layers, HardHat, X } from 'lucide-react';

interface SearchResult {
    type: 'customer' | 'installer' | 'project' | 'sample';
    id: number;
    title: string;
    subtitle: string | null;
}

const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
        case 'customer': return <User className="w-5 h-5 text-gray-400" />;
        case 'project': return <Briefcase className="w-5 h-5 text-gray-400" />;
        case 'installer': return <HardHat className="w-5 h-5 text-gray-400" />;
        case 'sample': return <Layers className="w-5 h-5 text-gray-400" />;
        default: return null;
    }
};

const getResultLink = (result: SearchResult): string => {
    switch (result.type) {
        case 'customer': return `/customers/${result.id}`;
        case 'project': return `/projects/${result.id}`;
        case 'installer': return `/installers/${result.id}`;
        case 'sample': return `/samples`; // Sample library doesn't have individual detail pages yet
        default: return '/';
    }
};


const UniversalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Debouncing logic
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setIsDropdownOpen(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(() => {
            fetch(`/api/search?q=${query}`)
                .then(res => res.json())
                .then(data => {
                    setResults(data);
                    setIsDropdownOpen(true);
                })
                .catch(console.error)
                .finally(() => setIsLoading(false));
        }, 300); // Wait 300ms after user stops typing

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

    const handleResultClick = (result: SearchResult) => {
        setQuery('');
        setResults([]);
        setIsDropdownOpen(false);
        // Special case for samples to open the modal, needs more complex state management
        if (result.type === 'sample') {
            navigate('/samples'); // For now, just go to the library
        }
    };

    return (
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
                <div className="absolute top-full mt-2 w-full bg-surface rounded-lg shadow-lg border border-border z-50 max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-gray-400">Searching...</div>
                    ) : results.length > 0 ? (
                        <ul>
                            {results.map((result) => (
                                <li key={`${result.type}-${result.id}`}>
                                    <Link 
                                        to={getResultLink(result)}
                                        onClick={() => handleResultClick(result)}
                                        className="flex items-center gap-4 p-3 hover:bg-gray-700 transition-colors"
                                    >
                                        {getResultIcon(result.type)}
                                        <div>
                                            <p className="font-semibold text-text-primary">{result.title}</p>
                                            {result.subtitle && <p className="text-xs text-text-secondary">{result.subtitle}</p>}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-gray-400">No results found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UniversalSearch;