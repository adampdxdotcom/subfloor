import React, { useState } from 'react';
import { STORAGE_KEY_API_URL } from '../utils/apiConfig';

export default function ServerConnect() {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    const handleConnect = () => {
        let cleanUrl = url.trim();
        if (!cleanUrl) return;

        // Auto-fix missing protocol
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = `https://${cleanUrl}`;
        }
        
        // Remove trailing slash
        cleanUrl = cleanUrl.replace(/\/$/, '');

        // VALIDATION: Strict check to prevent "https//flooring..." typos
        try {
            new URL(cleanUrl); 
        } catch (e) {
            setError('Invalid URL format. Must be like: https://flooring.mycompany.com');
            return;
        }

        console.log("💾 SAVING SERVER URL:", cleanUrl);
        localStorage.setItem(STORAGE_KEY_API_URL, cleanUrl);
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans text-neutral-200">
            <div className="w-full max-w-md">
                {/* Header Branding */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-neutral-100 mb-2 tracking-tight">Connect to Server</h1>
                    <p className="text-neutral-400">Enter your server address to connect.</p>
                </div>

                {/* Card Container */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6">
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                        Server URL
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setError(''); }}
                        placeholder="https://subfloor.mycompany.com"
                        className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent placeholder-neutral-500"
                    />
                    
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    
                    <button
                        onClick={handleConnect}
                        className="mt-6 w-full bg-primary hover:bg-primary-hover text-on-primary font-semibold py-3 px-6 rounded-full transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
                    >
                        Connect
                    </button>
                    
                    <button
                        onClick={() => {
                            localStorage.removeItem(STORAGE_KEY_API_URL);
                            window.location.reload();
                        }}
                        className="mt-4 w-full text-neutral-500 text-sm hover:text-neutral-300 transition-colors"
                    >
                        Clear Saved Server
                    </button>
                </div>
            </div>
        </div>
    );
}