import React from 'react';
import { DownloadCloud, Database, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import RestoreForm from '../components/RestoreForm'; // Import the new component

const Settings: React.FC = () => {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-text-primary mb-8 border-b border-border pb-4">
                Settings
            </h1>

            {/* Backup Section */}
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
                <h2 className="text-2xl font-semibold text-text-primary mb-4 flex items-center gap-3">
                    <DownloadCloud className="w-7 h-7 text-accent" />
                    Application Backup
                </h2>
                <p className="text-text-secondary mb-6 max-w-2xl">
                    Download ZIP archives of your critical application data. It is recommended to perform backups regularly and store the files in a safe, separate location.
                </p>
                <div className="flex flex-col md:flex-row gap-4">
                    <a
                        href="/api/backup/database"
                        download
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"
                    >
                        <Database className="w-6 h-6" />
                        Download Database Backup
                    </a>
                    <a
                        href="/api/backup/images"
                        download
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"
                    >
                        <ImageIcon className="w-6 h-6" />
                        Download Images Backup
                    </a>
                </div>
            </section>

            {/* Restore Section */}
            <section className="mt-12 bg-surface p-6 rounded-lg shadow-md border-2 border-red-500/50">
                <h2 className="text-2xl font-semibold text-red-400 mb-4 flex items-center gap-3">
                    <AlertTriangle className="w-7 h-7" />
                    Danger Zone: Restore from Backup
                </h2>
                <p className="text-text-secondary mb-6 max-w-2xl">
                    Restoring from a backup will permanently overwrite existing data. This action cannot be undone. Proceed with extreme caution.
                </p>
                <div className="space-y-6">
                    {/* Database Restore Form */}
                    <RestoreForm 
                        title="Database"
                        endpoint="/api/restore/database"
                        warningMessage="Are you ABSOLUTELY SURE you want to restore the database? This will completely ERASE the current database. All data entered since this backup was created will be lost forever. This action cannot be undone."
                    />
                    
                    {/* Images Restore Form */}
                    <RestoreForm 
                        title="Images"
                        endpoint="/api/restore/images"
                        warningMessage="Are you sure you want to restore the images? This will overwrite any new images that have been uploaded since this backup was created."
                    />
                </div>
            </section>
        </div>
    );
};

export default Settings;