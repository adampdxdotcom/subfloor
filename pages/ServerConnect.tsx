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
            setError('Invalid URL format. Must be like: https://flooring.dumbleigh.com');
            return;
        }

        console.log("💾 SAVING SERVER URL:", cleanUrl);
        localStorage.setItem(STORAGE_KEY_API_URL, cleanUrl);
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-white">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-amber-500">Subfloor</h1>
                    <p className="mt-2 text-gray-400">Enter your server address to connect.</p>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Server URL
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setError(''); }}
                        placeholder="https://flooring.dumbleigh.com"
                        className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    
                    <button
                        onClick={handleConnect}
                        className="mt-6 w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded transition-colors"
                    >
                        Connect
                    </button>
                    
                    {/* NEW: RESET BUTTON to escape bad states */}
                    <button
                        onClick={() => {
                            localStorage.removeItem(STORAGE_KEY_API_URL);
                            window.location.href = '/';
                        }}
                        className="mt-4 w-full text-gray-500 text-sm hover:text-gray-300"
                    >
                        Reset / Clear Storage
                    </button>
                </div>
            </div>
        </div>
    );
}