import React, { useState } from 'react';
import { UploadCloud, Database, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { signOut } from "supertokens-auth-react/recipe/session";

const CombinedRestoreForm: React.FC = () => {
    const [dbFile, setDbFile] = useState<File | null>(null);
    const [imgFile, setImgFile] = useState<File | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);

    const handleRestore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dbFile || !imgFile) return toast.error("Please select both files.");
        
        if (!window.confirm("WARNING: You are about to overwrite the ENTIRE system (Database + Images). This cannot be undone. Continue?")) return;

        setIsRestoring(true);
        const toastId = toast.loading("Starting Full System Restore...");

        try {
            // STEP 1: RESTORE IMAGES FIRST
            // We do this first because DB restore kills the session.
            toast.loading("Step 1/2: Restoring Images...", { id: toastId });
            
            const imgForm = new FormData();
            imgForm.append('backupFile', imgFile);
            
            const imgRes = await fetch('/api/restore/images', { method: 'POST', body: imgForm });
            if (!imgRes.ok) throw new Error("Image restore failed. Aborting DB restore.");

            // STEP 2: RESTORE DATABASE
            toast.loading("Step 2/2: Restoring Database...", { id: toastId });
            
            const dbForm = new FormData();
            dbForm.append('backupFile', dbFile);
            
            const dbRes = await fetch('/api/restore/database', { method: 'POST', body: dbForm });
            if (!dbRes.ok) throw new Error("Database restore failed.");

            // SUCCESS
            toast.success("Full System Restore Complete! Redirecting...", { id: toastId });
            
            // Force logout and redirect
            try { await signOut(); } catch (e) {}
            window.location.href = "/auth";

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Restore Failed", { id: toastId });
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <form onSubmit={handleRestore} className="bg-surface-container rounded-xl border border-outline/10 p-6">
            <h3 className="text-lg font-bold text-text-primary mb-2 text-center">Full System Restore</h3>
            <p className="text-text-secondary text-sm text-center mb-6">Upload both files to restore the entire application state in one go.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                        <Database size={16} /> Database File
                    </label>
                    <input 
                        type="file" accept=".zip" 
                        onChange={e => e.target.files && setDbFile(e.target.files[0])}
                        className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-outline file:bg-surface-container-high file:text-text-primary hover:file:bg-primary-container/30 transition-colors cursor-pointer"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                        <ImageIcon size={16} /> Images File
                    </label>
                    <input 
                        type="file" accept=".zip" 
                        onChange={e => e.target.files && setImgFile(e.target.files[0])}
                        className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-outline file:bg-surface-container-high file:text-text-primary hover:file:bg-primary-container/30 transition-colors cursor-pointer"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={!dbFile || !imgFile || isRestoring}
                className="w-full bg-error hover:bg-error-hover text-on-error font-bold py-3 px-6 rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
                <RotateCcw size={18} />
                {isRestoring ? 'Restoring System...' : 'Restore Everything'}
            </button>
        </form>
    );
};

export default CombinedRestoreForm;