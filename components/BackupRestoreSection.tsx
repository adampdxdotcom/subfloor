import React from 'react';
import { DownloadCloud, Database, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import RestoreForm from './RestoreForm';

const BackupRestoreSection: React.FC = () => {
    return (
        <>
            <section className="bg-surface p-6 rounded-lg shadow-md border border-border">
                <h2 className="text-2xl font-semibold text-text-primary mb-4 flex items-center gap-3"><DownloadCloud className="w-7 h-7 text-accent" />Application Backup</h2>
                <p className="text-text-secondary mb-6 max-w-2xl">Download ZIP archives of your critical application data. It is recommended to perform backups regularly and store the files in a safe, separate location.</p>
                <div className="flex flex-col md:flex-row gap-4">
                    <a href="/api/backup/database" download className="flex-1 bg-primary hover:bg-primary-hover text-on-primary font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"><Database className="w-6 h-6" />Download Database Backup</a>
                    <a href="/api/backup/images" download className="flex-1 bg-accent hover:bg-accent-hover text-on-accent font-bold py-3 px-5 rounded-lg transition-colors flex items-center justify-center gap-3"><ImageIcon className="w-6 h-6" />Download Images Backup</a>
                </div>
            </section>
            <section className="mt-8 bg-surface p-6 rounded-lg shadow-md border-2 border-red-500/50">
                <h2 className="text-2xl font-semibold text-red-400 mb-4 flex items-center gap-3"><AlertTriangle className="w-7 h-7" />Danger Zone: Restore from Backup</h2>
                <p className="text-text-secondary mb-6 max-w-2xl">Restoring from a backup will permanently overwrite existing data. This action cannot be undone. Proceed with extreme caution.</p>
                <div className="space-y-6">
                    <RestoreForm title="Database" endpoint="/api/restore/database" warningMessage="Are you ABSOLUTELY SURE you want to restore the database? This will completely ERASE the current database. All data entered since this backup was created will be lost forever. This action cannot be undone." />
                    <RestoreForm title="Images" endpoint="/api/restore/images" warningMessage="Are you sure you want to restore the images? This will overwrite any new images that have been uploaded since this backup was created." />
                </div>
            </section>
        </>
    );
};

export default BackupRestoreSection;