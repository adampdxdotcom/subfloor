import React, { useState } from 'react';
import { STORAGE_KEY_API_URL } from '../utils/apiConfig';

export default function ServerConnect() {
    const [url, setUrl] = useState('');

    const handleConnect = () => {
        // Basic validation
        let cleanUrl = url.trim();
        if (!cleanUrl) return;
        
        // Ensure https://
        if (!cleanUrl.startsWith('http')) {
            cleanUrl = `https://${cleanUrl}`;
        }
        
        // Remove trailing slash
        cleanUrl = cleanUrl.replace(/\/$/, '');

        // Save and Reload
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
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://flooring.dumbleigh.com"
                        className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    
                    <button
                        onClick={handleConnect}
                        className="mt-6 w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded transition-colors"
                    >
                        Connect
                    </button>
                </div>
            </div>
        </div>
    );
}