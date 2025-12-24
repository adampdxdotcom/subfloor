import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Folder, FileText, Search, ArrowLeft, Save, Tag, Edit2, Link as LinkIcon, X, Menu, History } from 'lucide-react';
import RichTextEditor from '../components/kb/RichTextEditor';
import { useData } from '../context/DataContext';
import { toast } from 'react-hot-toast';
import ArticleHistoryView from '../components/kb/ArticleHistoryView';
import { getEndpoint, getImageUrl } from '../utils/apiConfig';
import { readStyles } from '../components/kb/kbStyles';

// Simple Modal for creating categories
const CreateCategoryModal = ({ onClose, onSave }: { onClose: () => void, onSave: (name: string) => void }) => {
    const [name, setName] = useState('');
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-border p-6 rounded-lg w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-text-primary mb-4">New Category</h3>
                <input 
                    autoFocus
                    className="w-full bg-background border border-border rounded p-2 text-text-primary mb-4 focus:ring-2 focus:ring-primary outline-none"
                    placeholder="e.g. Installation Guides"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onSave(name)}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-text-secondary hover:text-text-primary">Cancel</button>
                    <button onClick={() => onSave(name)} disabled={!name} className="px-3 py-1.5 bg-primary text-on-primary rounded font-bold hover:bg-primary-hover disabled:opacity-50">Create</button>
                </div>
            </div>
        </div>
    );
};

// --- HELPER: Slugify text for IDs ---
const slugify = (text: string) => {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           
        .replace(/[^\w\-]+/g, '')       
        .replace(/\-\-+/g, '-')         
        .replace(/^-+/, '')             
        .replace(/-+$/, '');            
};

// --- HELPER: Inject IDs into Headers (Runs on Save) ---
const injectHeaderIds = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    doc.querySelectorAll('h1, h2, h3').forEach((header) => {
        if (!header.id) {
            header.id = slugify(header.textContent || '');
        }
    });
    return doc.body.innerHTML;
};

// --- HELPER: Extract Headers for TOC (Runs on Read) ---
const extractHeaders = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headers: { id: string, text: string, level: number }[] = [];
    
    doc.querySelectorAll('h1, h2, h3').forEach((header) => {
        if (header.id && header.textContent) {
            headers.push({
                id: header.id,
                text: header.textContent,
                level: parseInt(header.tagName.substring(1))
            });
        }
    });
    return headers;
};

export default function KnowledgeBase() {
    const { currentUser } = useData();
    const isAdmin = currentUser?.roles?.includes('Admin');

    const [view, setView] = useState<'list' | 'read' | 'edit' | 'history'>('list');
    const [categories, setCategories] = useState<any[]>([]);
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [articles, setArticles] = useState<any[]>([]); 
    const [searchQuery, setSearchQuery] = useState('');
    const [currentArticle, setCurrentArticle] = useState<any>(null);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(false);

    // Editor State
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editCategoryId, setEditCategoryId] = useState<number | string>('');
    const [editTags, setEditTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    
    // TOC State
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);

    // Load Categories on mount
    useEffect(() => {
        fetchCategories();
    }, []);

    // Load Articles when Category or Search changes
    useEffect(() => {
        // Debounce search or immediate category load
        const timer = setTimeout(() => {
            if (searchQuery) fetchArticles(null, searchQuery);
            else if (activeCategory) fetchArticles(activeCategory);
        }, 300);
        return () => clearTimeout(timer);
    }, [activeCategory, searchQuery]);

    // Clear search when clicking a category
    useEffect(() => {
        if (activeCategory) setSearchQuery('');
    }, [activeCategory]);

    // SCROLL HANDLER: Runs when article loads to handle deep links
    useEffect(() => {
        if (currentArticle && pendingAnchor) {
            // Increased timeout to ensure DOM is fully painted
            const timer = setTimeout(() => {
                const el = document.getElementById(pendingAnchor);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setPendingAnchor(null); // Clear the jump
                }
            }, 300); // 300ms is usually safe for large renders
            return () => clearTimeout(timer);
        }
    }, [currentArticle, pendingAnchor]);

    // CAPTION HYDRATION (Read Mode)
    useEffect(() => {
        if (view === 'read' && currentArticle) {
            // Allow DOM to paint
            setTimeout(() => {
                const container = document.querySelector('.kb-read-content');
                if (!container) return;

                // Fix Image Sources for Mobile
                container.querySelectorAll('img').forEach((img: any) => {
                    const currentSrc = img.getAttribute('src');
                    if (currentSrc && !currentSrc.startsWith('http')) {
                        img.src = getImageUrl(currentSrc);
                    }
                });

                container.querySelectorAll('img[data-caption]').forEach((img: any) => {
                    // Skip if already wrapped (prevents double wrapping on re-renders)
                    if (img.parentElement.tagName === 'FIGURE') return;

                    const captionText = img.getAttribute('data-caption');
                    if (!captionText) return;

                    const figure = document.createElement('figure');
                    const figcaption = document.createElement('figcaption');
                    figcaption.innerText = captionText;

                    // FIX: Read 'align' attribute to apply styles to the Figure wrapper
                    const align = img.getAttribute('align');
                    if (align === 'left') {
                        figure.style.float = 'left';
                        figure.style.margin = '0.5em 1.5em 1em 0';
                    } else if (align === 'right') {
                        figure.style.float = 'right';
                        figure.style.margin = '0.5em 0 1em 1.5em';
                    }
                    
                    img.parentNode.insertBefore(figure, img);
                    figure.appendChild(img);
                    figure.appendChild(figcaption);
                });
            }, 100);
        }
    }, [view, currentArticle]);

    const fetchCategories = async () => {
        try {
            const res = await axios.get(getEndpoint('/api/kb/categories'), { withCredentials: true });
            setCategories(res.data);
            // Auto-select first category if none selected and categories exist
            if (!activeCategory && res.data.length > 0) {
                setActiveCategory(res.data[0].id);
            }
        } catch (e) { console.error(e); }
    };

    const fetchArticles = async (catId: number | null, query?: string) => {
        try {
            let path = '/api/kb/search';
            if (query) path += `?q=${encodeURIComponent(query)}`;
            else if (catId) path += `?cat=${catId}`;
            else return;
            
            const res = await axios.get(getEndpoint(path), { withCredentials: true }); 
            setArticles(res.data);
        } catch (e) { console.error(e); }
    };

    const handleCreateCategory = async (name: string) => {
        try {
            await axios.post(getEndpoint('/api/kb/categories'), { name }, { withCredentials: true });
            toast.success("Category created");
            fetchCategories();
            setIsCatModalOpen(false);
        } catch (e) { toast.error("Failed to create category"); }
    };

    // Updated to accept an optional initial title from search
    const handleCreateArticle = (initialTitle = '') => {
        setEditTitle(initialTitle);
        setEditContent('<p>Start writing...</p>');
        setEditCategoryId(activeCategory || '');
        setEditTags([]);
        setCurrentArticle(null);
        // Clear search so we don't see the result screen when we come back
        setSearchQuery('');
        setView('edit');
    };

    const handleEditArticle = (article: any) => {
        // FIX: Clear current article FIRST.
        // This ensures the UI goes "Loading" and the useEffect hook won't fire 
        // using the OLD article data with the NEW anchor.
        setCurrentArticle(null);
        
        axios.get(getEndpoint(`/api/kb/articles/${article.id}`), { withCredentials: true }).then(res => {
            setCurrentArticle(res.data);
            setToc(extractHeaders(res.data.content)); // Build TOC
            setView('read');
        });
    };

    const startEditing = () => {
        if (!currentArticle) return;
        setEditTitle(currentArticle.title);
        setEditContent(currentArticle.content || '');
        setEditCategoryId(currentArticle.category_id || '');
        setEditTags(currentArticle.tags || []);
        setView('edit');
    };

    const handleSave = async () => {
        if (!editTitle) return toast.error("Title is required");
        if (!editCategoryId) return toast.error("Category is required");

        // Auto-generate IDs for Deep Linking
        const contentWithIds = injectHeaderIds(editContent);

        try {
            const payload = { 
                title: editTitle, 
                content: contentWithIds, 
                categoryId: Number(editCategoryId), 
                isPublished: true,
                tags: editTags
            };
            
            if (currentArticle?.id) {
                const res = await axios.put(getEndpoint(`/api/kb/articles/${currentArticle.id}`), payload, { withCredentials: true });
                toast.success("Article updated");
                setCurrentArticle({ ...currentArticle, id: currentArticle?.id, title: editTitle, content: contentWithIds, tags: editTags, updated_at: res.data.updated_at });
            } else {
                const res = await axios.post(getEndpoint('/api/kb/articles'), payload, { withCredentials: true });
                toast.success("Article created");
                setCurrentArticle({ ...res.data, author_name: currentUser?.firstName, title: editTitle, content: contentWithIds, tags: editTags }); 
            }
            
            // Refresh and go back
            fetchArticles(Number(editCategoryId)); // Refresh list
            setActiveCategory(Number(editCategoryId));
            // Go back to read mode for this article
            setToc(extractHeaders(contentWithIds)); // Update TOC
            setView('read');
        } catch (e) { 
            console.error(e);
            toast.error("Failed to save");
        }
    };

    const addTag = () => {
        if (tagInput && !editTags.includes(tagInput.trim())) {
            setEditTags([...editTags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRestoreContent = (oldContent: string) => {
        // 1. Update content state
        setEditContent(oldContent);
        // 2. Switch to Edit Mode immediately
        setEditTags(currentArticle?.tags || []); // Preserve tags
        setView('edit');
    };

    return (
        <div className="h-full flex flex-col">
            {/* SECTION 1: HEADER BOX */}
            <div className="bg-surface p-6 rounded-lg shadow-md mb-6 border border-border flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Knowledge Base</h1>
                    <p className="text-text-secondary mt-1">Manage documentation, guides, and internal resources.</p>
                </div>
            </div>
            
            {/* MAIN APP CONTAINER */}
            <div className="flex-1 flex min-h-0 bg-surface border border-border rounded-lg overflow-hidden shadow-sm relative">
                
                {/* SIDEBAR: Categories */}
                <div className={`border-r border-border bg-background flex flex-col transition-all duration-200 
                    ${showSidebar ? 'absolute inset-0 z-50 w-full' : 'hidden md:flex w-64'}
                `}>
                    <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
                        <h2 className="font-bold text-text-primary flex items-center gap-2">
                            <Folder className="text-primary w-5 h-5" /> Library
                        </h2>
                        <div className="flex items-center gap-2">
                            {isAdmin && (
                                <button onClick={() => setIsCatModalOpen(true)} className="text-primary hover:bg-primary/10 p-1.5 rounded transition-colors" title="New Category">
                                    <Plus size={18} />
                                </button>
                            )}
                            <button onClick={() => setShowSidebar(false)} className="md:hidden text-text-secondary p-1"><X size={20} /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {categories.length === 0 && <div className="text-sm text-text-tertiary p-4 text-center">No categories yet.</div>}
                        {categories.map(cat => (
                            <div key={cat.id}>
                                {/* Category Header */}
                                <button 
                                    onClick={() => {
                                        setActiveCategory(cat.id);
                                        // Don't force 'list' view if just expanding
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                                        activeCategory === cat.id 
                                            ? 'bg-primary/10 text-primary font-bold' 
                                            : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                                    }`}
                                >
                                    <Folder size={16} className={activeCategory === cat.id ? 'text-primary' : 'text-text-tertiary'} />
                                    <span className="truncate">{cat.name}</span>
                                </button>

                                {/* Nested Articles (Tree) */}
                                {activeCategory === cat.id && (
                                    <div className="ml-4 border-l border-border pl-2 mt-1 space-y-0.5">
                                        {articles.map(art => (
                                            <button
                                                key={art.id}
                                                onClick={() => { handleEditArticle(art); setShowSidebar(false); }} // Or View
                                                className={`block w-full text-left px-2 py-1.5 text-xs truncate rounded ${currentArticle?.id === art.id ? 'text-primary bg-primary/5 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
                                            >
                                                {art.title}
                                            </button>
                                        ))}
                                        {articles.length === 0 && <div className="text-[10px] text-text-tertiary px-2 py-1 italic">No articles</div>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="flex-1 flex flex-col bg-surface">
                    
                    {/* VIEW: LIST OF ARTICLES */}
                    {view === 'list' && (
                        <div className="flex flex-col h-full">
                            {/* HEADER: Responsive Layout */}
                            <div className="p-4 md:p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                                
                                {/* Row 1: Title & Mobile Controls */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setShowSidebar(true)} className="md:hidden text-primary hover:bg-primary/10 p-1 rounded"><Menu size={24} /></button>
                                        <div>
                                            {searchQuery ? (
                                                <h1 className="text-xl md:text-2xl font-bold text-text-primary">Search Results</h1>
                                            ) : (
                                                <>
                                                    <h1 className="text-xl md:text-2xl font-bold text-text-primary">
                                                        {categories.find(c => c.id === activeCategory)?.name || 'Library'}
                                                    </h1>
                                                    <p className="text-text-secondary text-xs md:text-sm">{articles.length} articles</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Mobile "New" Button */}
                                    {isAdmin && activeCategory && (
                                        <button onClick={() => handleCreateArticle()} className="md:hidden text-primary bg-primary/10 p-2 rounded-full">
                                            <Plus size={20} />
                                        </button>
                                    )}
                                </div>

                                {/* Row 2: Search Bar & Desktop "New" Button */}
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="relative w-full md:w-64 lg:w-80">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
                                        <input 
                                            className="w-full bg-background border border-border rounded pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                            placeholder="Search..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    {isAdmin && activeCategory && (
                                        <button onClick={() => handleCreateArticle()} className="hidden md:flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-primary-hover transition-colors">
                                            <Plus size={18} /> New Article
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {/* ON-THE-FLY CREATION: Show if searching and Admin */}
                                {isAdmin && searchQuery && (
                                    <button 
                                        onClick={() => handleCreateArticle(searchQuery)}
                                        className="w-full mb-4 p-4 border border-dashed border-primary/50 bg-primary/5 rounded-lg flex items-center justify-center gap-2 text-primary font-bold hover:bg-primary/10 transition-colors"
                                    >
                                        <Plus size={18} />
                                        Create new article: "{searchQuery}"
                                    </button>
                                )}

                                {articles.length === 0 ? (
                                    // Only show empty state if we aren't showing the create button above (or to show context)
                                    <div className="text-center py-8 text-text-tertiary">
                                        {!isAdmin && <p>No articles found.</p>}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {articles.map(article => (
                                            <div 
                                                key={article.id} 
                                                onClick={() => handleEditArticle(article)}
                                                className="p-4 rounded-lg border border-border bg-background hover:border-primary hover:shadow-md transition-all cursor-pointer group"
                                            >
                                                <h3 className="font-bold text-lg text-text-primary group-hover:text-primary mb-1">{article.title}</h3>
                                                <div className="flex items-center gap-4 text-xs text-text-secondary">
                                                    <span>Updated {new Date(article.updated_at).toLocaleDateString()}</span>
                                                    {article.tags && article.tags.length > 0 && (
                                                        <span className="flex items-center gap-1"><Tag size={12} /> {article.tags.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW: READ ARTICLE */}
                    {view === 'read' && currentArticle && (
                        <div className="flex flex-col h-full relative">
                            {/* Header */}
                            <div className="p-6 border-b border-border flex justify-between items-start bg-surface">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button onClick={() => setView('list')} className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1">
                                            <ArrowLeft size={14} /> Back
                                        </button>
                                        <span className="text-border">|</span>
                                        <span className="text-xs text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                                            {categories.find(c => c.id === currentArticle.category_id)?.name}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-text-primary">{currentArticle.title}</h1>
                                    <p className="text-xs text-text-secondary mt-2">Last updated {new Date(currentArticle.updated_at).toLocaleDateString()}</p>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2">
                                        <button onClick={() => setView('history')} className="p-2 text-text-secondary hover:text-primary hover:bg-background rounded-lg border border-transparent hover:border-border transition-all" title="View History">
                                            <History size={20} />
                                        </button>
                                        <button onClick={startEditing} className="p-2 text-text-secondary hover:text-primary hover:bg-background rounded-lg border border-transparent hover:border-border transition-all" title="Edit Article">
                                            <Edit2 size={20} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Content Body + TOC Grid */}
                            <div className="flex-1 overflow-hidden flex">
                                <div 
                                    className="flex-1 overflow-y-auto p-6 md:p-8 flow-root" 
                                    onClick={(e) => {
                                        // INTERCEPT MENTION CLICKS
                                        if (e.target.tagName === 'IMG') {
                                            // @ts-ignore
                                            window.open(e.target.src, '_blank');
                                            return;
                                        }
                                        // @ts-ignore
                                        const target = e.target.closest('.kb-mention');
                                        if (target) {
                                            const id = target.getAttribute('data-id');
                                            const anchor = target.getAttribute('data-anchor');
                                            
                                            if (id) {
                                                // 1. Same Article? Just Scroll.
                                                if (Number(id) === currentArticle.id && anchor) {
                                                    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
                                                    return;
                                                }
                                                
                                                // 2. Different Article? Load + Queue Scroll
                                                if (Number(id) !== currentArticle.id) {
                                                    if (anchor) setPendingAnchor(anchor);
                                                    handleEditArticle({ id }); 
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <style>{readStyles}</style>
                                    <div 
                                        className="kb-read-content max-w-3xl mx-auto"
                                        dangerouslySetInnerHTML={{ __html: currentArticle.content }}
                                    />
                                </div>

                                {/* Right Sidebar: Table of Contents */}
                                {toc.length > 0 && (
                                    <div className="w-64 border-l border-border bg-background p-6 hidden xl:block overflow-y-auto">
                                        <h4 className="font-bold text-text-secondary text-xs uppercase tracking-wider mb-4">On this page</h4>
                                        <div className="space-y-2 border-l border-border">
                                            {toc.map((item, i) => (
                                                <div key={i} className="group flex items-center justify-between pl-3 hover:border-l hover:-ml-[1px] hover:border-primary transition-all">
                                                    <a 
                                                        href={`#${item.id}`} 
                                                        className={`block text-xs hover:text-primary truncate ${
                                                            item.level === 3 ? 'ml-2 text-text-tertiary' : 'text-text-secondary'
                                                        }`}
                                                    >
                                                        {item.text}
                                                    </a>
                                                    {/* Copy Anchor Link Button */}
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            navigator.clipboard.writeText(`${window.location.href}#${item.id}`);
                                                            toast.success("Section link copied!");
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-text-tertiary hover:text-primary transition-opacity"
                                                        title="Copy Link to Section"
                                                    >
                                                        <LinkIcon size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW: HISTORY */}
                    {view === 'history' && currentArticle && (
                        <ArticleHistoryView 
                            articleId={currentArticle.id}
                            onClose={() => setView('read')}
                            onRestore={handleRestoreContent}
                        />
                    )}

                    {/* VIEW: EDIT/CREATE */}
                    {view === 'edit' && (
                        <div className="flex flex-col h-full">
                            {/* Header - Layout matched to Read View to prevent jumping */}
                            <div className="p-6 border-b border-border flex justify-between items-start bg-surface">
                                <div className="w-full mr-4">
                                    {/* Row 1: Nav & Meta controls */}
                                    <div className="flex items-center gap-2 mb-2 h-6">
                                        <button onClick={() => currentArticle ? setView('read') : setView('list')} className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1">
                                            <ArrowLeft size={14} /> Cancel
                                        </button>
                                        <span className="text-border">|</span>
                                        {/* Category Select (Matches Breadcrumb position) */}
                                        <select 
                                            value={editCategoryId} 
                                            onChange={e => setEditCategoryId(e.target.value)}
                                            className="bg-transparent text-xs font-bold uppercase tracking-wider text-primary border-none outline-none cursor-pointer hover:bg-primary/5 rounded px-1 -ml-1"
                                        >
                                            <option value="" disabled>Select Category</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Row 2: Title Input (Matches H1 position) */}
                                    <input 
                                        type="text" 
                                        placeholder="Article Title" 
                                        className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder-text-tertiary text-text-primary p-0 m-0 focus:ring-0"
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                    />
                                    
                                    {/* TAGS INPUT */}
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        {editTags.map(tag => (
                                            <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                                                {tag}
                                                <button onClick={() => setEditTags(editTags.filter(t => t !== tag))}><X size={12} /></button>
                                            </span>
                                        ))}
                                        <div className="flex items-center gap-1">
                                            <Tag size={14} className="text-text-tertiary" />
                                            <input 
                                                className="bg-transparent border-none outline-none text-xs text-text-primary placeholder-text-tertiary min-w-[80px]"
                                                placeholder="Add tag..."
                                                value={tagInput}
                                                onChange={e => setTagInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && addTag()}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Save Button (Matches Edit Button position) */}
                                <div className="flex-shrink-0">
                                    <button onClick={handleSave} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-1.5 rounded-lg font-bold hover:bg-primary-hover transition-colors shadow-sm">
                                        <Save size={18} /> Save
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden p-0 md:p-8 w-full flex flex-col">
                                <RichTextEditor content={editContent} onChange={setEditContent} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL */}
            {isCatModalOpen && <CreateCategoryModal onClose={() => setIsCatModalOpen(false)} onSave={handleCreateCategory} />}
        </div>
    );
}