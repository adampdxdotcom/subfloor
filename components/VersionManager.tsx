import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { App as CapacitorApp } from '@capacitor/app';
import { api } from '../utils/apiConfig';
import { ForceUpdateModal } from './ForceUpdateModal'; // New
import localMetadata from '../../metadata.json'; 

export const VersionManager: React.FC = () => {
    const [forceUpdate, setForceUpdate] = useState<{ required: number; current: number; url: string } | null>(null);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // 1. Get Server Info
                const { data: serverInfo } = await api.get('/system/info');
                const isNative = (window as any).Capacitor?.isNativePlatform();

                // 2. CHECK MOBILE (Native Only)
                if (isNative) {
                    const appInfo = await CapacitorApp.getInfo();
                    // Parse build number safely (Android build is string, e.g. "10")
                    const currentBuild = parseInt(appInfo.build || '0', 10);
                    const minBuild = parseInt(serverInfo.minMobileBuild || '0', 10);

                    if (currentBuild < minBuild) {
                        console.warn(`🔒 Force Update Triggered: Build ${currentBuild} < ${minBuild}`);
                        setForceUpdate({
                            current: currentBuild,
                            required: minBuild,
                            url: serverInfo.apkDownloadUrl || 'https://github.com'
                        });
                        return; // Stop checking web version if app is broken
                    }
                }

                // 3. CHECK WEB (Browser Only - or Mobile if build is OK)
                // We compare the string versions
                if (serverInfo.version && serverInfo.version !== localMetadata.version) {
                    toast((t) => (
                        <div className="flex flex-col gap-2">
                            <span className="font-semibold">
                                New update available!
                                <span className="block text-xs font-normal opacity-75">
                                    v{localMetadata.version} → v{serverInfo.version}
                                </span>
                            </span>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-primary text-white px-3 py-1.5 rounded text-sm hover:bg-primary-hover transition-colors"
                            >
                                Refresh to Update
                            </button>
                        </div>
                    ), {
                        id: 'version-update-toast',
                        duration: Infinity,
                        position: 'bottom-right',
                        icon: '🚀',
                        style: { border: '1px solid #3b82f6', padding: '16px' },
                    });
                }
            } catch (error) {
                console.warn('Failed to check version:', error);
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (forceUpdate) {
        return (
            <ForceUpdateModal 
                currentBuild={forceUpdate.current}
                requiredBuild={forceUpdate.required}
                downloadUrl={forceUpdate.url}
            />
        );
    }

    return null;
};