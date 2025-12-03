import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { signOut } from "supertokens-auth-react/recipe/session";

interface RestoreFormProps {
  title: string;
  endpoint: string;
  warningMessage: string;
}

const RestoreForm: React.FC<RestoreFormProps> = ({ title, endpoint, warningMessage }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a backup file to restore.');
      return;
    }

    if (!window.confirm(warningMessage)) {
      return;
    }

    setIsRestoring(true);
    const toastId = toast.loading(`Restoring ${title.toLowerCase()}...`);

    const formData = new FormData();
    formData.append('backupFile', file);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to restore ${title.toLowerCase()}.`);
      }

      toast.success(`${title} restored successfully! The application will now reload.`, {
        id: toastId,
        duration: 4000,
      });
      
      if (title === 'Database') {
        await signOut();
        window.location.href = "/auth";
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }

    } catch (error) {
      console.error(`Restore error for ${title}:`, error);
      toast.error((error as Error).message, { id: toastId });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border mt-6 pt-6">
      <h3 className="font-semibold text-lg text-text-primary mb-2">{title}</h3>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <input
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-text-primary hover:file:bg-gray-600 w-full sm:w-auto"
        />
        <button
          type="submit"
          disabled={!file || isRestoring}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:bg-red-900 disabled:cursor-not-allowed"
        >
          <UploadCloud size={18} />
          {isRestoring ? 'Restoring...' : `Restore ${title}`}
        </button>
      </div>
      {file && <p className="text-sm text-text-secondary mt-2">Selected file: {file.name}</p>}
    </form>
  );
};

export default RestoreForm;