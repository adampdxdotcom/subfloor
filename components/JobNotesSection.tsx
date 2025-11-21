import React, { useState, useEffect } from 'react';
import { Job } from '../types';
import { Save, Move } from 'lucide-react'; // <-- IMPORT Move

interface JobNotesSectionProps {
  job: Job | null | undefined;
  onSaveNotes: (notes: string) => Promise<void>;
}

const JobNotesSection: React.FC<JobNotesSectionProps> = ({ job, onSaveNotes }) => {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNotes(job?.notes ?? '');
  }, [job]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveNotes(notes);
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!job) {
    return null;
  }

  return (
    <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
      <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
            <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
            <h3 className="text-xl font-semibold text-text-primary">Job Notes</h3>
        </div>
      </div>
      
      <div className="p-4 overflow-y-auto flex-grow flex flex-col">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any internal notes about the job, scheduling, materials, etc."
          className="w-full flex-grow p-2 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:ring-2 focus:ring-primary focus:outline-none transition"
          disabled={isSaving}
        />
      </div>
      
      <div className="p-4 border-t border-border flex justify-end flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={isSaving || notes === (job?.notes ?? '')}
          className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
  );
};

export default JobNotesSection;