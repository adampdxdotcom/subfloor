import React from 'react';
import { DownloadCloud, Database, Image as ImageIcon, RotateCcw } from 'lucide-react';
import RestoreForm from './RestoreForm';
import CombinedRestoreForm from './CombinedRestoreForm';

const BackupRestoreSection: React.FC = () => {
    return (
        <div className="space-y-8">
            {/* SECTION 1: DOWNLOADS */}
            <section className="py-6 border-b border-outline/10 md:bg-surface-container-low md:p-8 md:rounded-2xl md:shadow-sm md:border md:border-outline/10 md:border-b-outline/10">
                <h2 className="text-xl font-semibold text-text-primary mb-3 flex items-center gap-3">
                    <DownloadCloud className="w-6 h-6 text-primary" />
                    Create Backups
                </h2>
                <p className="text-text-secondary mb-6 text-sm">
                    Download ZIP archives of your critical data. Store these in a safe location.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <a href="/api/backup/database" download className="flex flex-col items-center justify-center p-6 bg-surface-container-highest border border-outline/10 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group">
                        <Database className="w-8 h-8 text-primary group-hover:text-primary mb-3" />
                        <span className="font-bold text-text-primary">Database Backup</span>
                        <span className="text-xs text-text-secondary">Customers, Projects, Settings</span>
                    </a>
                    <a href="/api/backup/images" download className="flex flex-col items-center justify-center p-6 bg-surface-container-highest border border-outline/10 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group">
                        <ImageIcon className="w-8 h-8 text-primary group-hover:text-primary mb-3" />
                        <span className="font-bold text-text-primary">Image Library Backup</span>
                        <span className="text-xs text-text-secondary">Photos, Logos, Uploads</span>
                    </a>
                </div>
            </section>

            {/* SECTION 2: RESTORE TOOLS */}
            <section className="py-6 md:bg-surface-container-low md:p-8 md:rounded-2xl md:shadow-sm md:border md:border-outline/10">
                <h2 className="text-xl font-semibold text-text-primary mb-3 flex items-center gap-3">
                    <RotateCcw className="w-6 h-6 text-primary" />
                    System Recovery
                </h2>
                
                <div className="bg-error/10 border border-error/20 rounded-xl p-4 mb-8 text-sm text-text-primary flex gap-3 items-start">
                     <span className="text-error font-bold">Warning:</span> Restoring will permanently overwrite existing data. Ensure you have a recent backup before proceeding.
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Database */}
                    <div>
                        <RestoreForm 
                            title="Database Only" 
                            icon={Database}
                            endpoint="/api/restore/database" 
                            warningMessage="Overwrite current database? Current data will be lost." 
                        />
                    </div>

                    {/* Right Column: Images */}
                    <div className="lg:border-l lg:border-outline/10 lg:pl-8">
                        <RestoreForm 
                            title="Images Only" 
                            icon={ImageIcon}
                            endpoint="/api/restore/images" 
                            warningMessage="Overwrite image library? New images may be lost." 
                        />
                    </div>
                </div>

                <div className="border-t border-outline/10 my-8"></div>

                {/* Combined Restore */}
                <div className="max-w-2xl mx-auto">
                    <CombinedRestoreForm />
                </div>
            </section>
        </div>
    );
};

export default BackupRestoreSection;