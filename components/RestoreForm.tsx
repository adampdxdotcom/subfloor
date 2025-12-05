import React, { useState } from 'react';
import { UploadCloud, LucideIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { signOut } from "supertokens-auth-react/recipe/session";

interface RestoreFormProps {
  title: string;
  endpoint: string;
  warningMessage: string;
  icon?: LucideIcon;
}

const RestoreForm: React.FC<RestoreFormProps> = ({ title, endpoint, warningMessage, icon: Icon }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file.');
    if (!window.confirm(warningMessage)) return;

    setIsRestoring(true);
    const toastId = toast.loading(`Restoring ${title}...`);

    const formData = new FormData();
    formData.append('backupFile', file);

    try {
      const response = await fetch(endpoint, { method: 'POST', body: formData });
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Restore failed');
      }

      toast.success('Restore successful!', { id: toastId });
      
      if (endpoint.includes('database')) {
        try { await signOut(); } catch (e) {}
        window.location.href = "/auth";
      } else {
        setTimeout(() => window.location.reload(), 1500);
      }

    } catch (error) {
      console.error(error);
      toast.error((error as Error).message, { id: toastId });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-5 h-5 text-text-secondary" />}
        <h3 className="font-semibold text-text-primary">{title}</h3>
      </div>
      
      <div className="flex-1 bg-background rounded border border-border border-dashed p-4 flex flex-col justify-center items-center gap-2 hover:border-primary transition-colors">
        <input
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-surface file:text-text-primary hover:file:bg-primary hover:file:text-on-primary"
        />
      </div>
      
      <button
        type="submit"
        disabled={!file || isRestoring}
        className="mt-4 w-full bg-secondary hover:bg-secondary-hover text-on-secondary font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UploadCloud size={16} />
        {isRestoring ? 'Restoring...' : 'Start Restore'}
      </button>
    </form>
  );
};

export default RestoreForm;