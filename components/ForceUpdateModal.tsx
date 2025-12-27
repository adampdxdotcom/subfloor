import React from 'react';
import { DownloadCloud, AlertTriangle } from 'lucide-react';
import ModalPortal from './ModalPortal';

interface ForceUpdateModalProps {
    currentBuild: number;
    requiredBuild: number;
    downloadUrl: string;
}

export const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({ 
    currentBuild, 
    requiredBuild,
    downloadUrl
}) => {
    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-surface w-full max-w-md rounded-xl p-8 shadow-2xl border border-red-500/30 text-center animate-in zoom-in-95 duration-200">
                    
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-text-primary mb-2">Update Required</h2>
                    
                    <p className="text-text-secondary mb-6 leading-relaxed">
                        This version of the app is outdated and is no longer supported by the server. 
                        Please download the latest version to continue.
                    </p>

                    <div className="bg-surface-highlight rounded-lg p-4 mb-8 text-sm text-text-secondary border border-border">
                        <div className="flex justify-between mb-1">
                            <span>Your Build:</span>
                            <span className="font-mono text-red-500">{currentBuild}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Required:</span>
                            <span className="font-mono text-green-500">{requiredBuild}+</span>
                        </div>
                    </div>

                    <a 
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold transition-transform active:scale-95"
                    >
                        <DownloadCloud size={20} />
                        Download Update
                    </a>

                </div>
            </div>
        </ModalPortal>
    );
};