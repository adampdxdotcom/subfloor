import React, { useState, useEffect } from 'react';
import ModalPortal from '../ModalPortal';
import RichTextEditor from '../kb/RichTextEditor'; // Reusing your existing editor!
import { EmailTemplate } from '../../types';
import { emailTemplateService } from '../../services/emailTemplateService';
import { X, Save, Send, RefreshCw, AlertTriangle } from 'lucide-react';

interface EmailTemplateModalProps {
  templateKey: string | null;
  onClose: () => void;
  onSave: () => void;
}

export const EmailTemplateModal: React.FC<EmailTemplateModalProps> = ({ 
  templateKey, 
  onClose, 
  onSave 
}) => {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showTestInput, setShowTestInput] = useState(false);

  useEffect(() => {
    if (templateKey) {
      loadTemplate();
    }
  }, [templateKey]);

  const loadTemplate = async () => {
    if (!templateKey) return;
    setLoading(true);
    try {
      const data = await emailTemplateService.getByKey(templateKey);
      setTemplate(data);
      setSubject(data.subject);
      // If body_content is null (using file system), start empty or maybe show a placeholder?
      // For now, let's just start empty to imply "Custom Override"
      setContent(data.body_content || '<p>Start typing to override the system default...</p>');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!templateKey) return;
    setSaving(true);
    try {
      await emailTemplateService.update(templateKey, {
        subject,
        body_content: content
      });
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure? This will delete your custom template and revert to the system default file.')) return;
    if (!templateKey) return;
    
    setSaving(true);
    try {
      await emailTemplateService.update(templateKey, {
        subject: template?.subject || '', // Keep subject or reset? Usually keep current subject but reset body
        body_content: null // specific signal to backend to use file
      });
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !templateKey) return;
    try {
      // First save current state so we test what we see
      await emailTemplateService.update(templateKey, { subject, body_content: content });
      await emailTemplateService.sendTest(templateKey, testEmail);
      alert(`Test email sent to ${testEmail}`);
      setShowTestInput(false);
    } catch (err) {
      alert('Failed to send test email');
    }
  };

  if (!templateKey) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative w-full max-w-4xl bg-surface rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-highlight rounded-t-xl">
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                {loading ? 'Loading...' : `Edit: ${template?.description}`}
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                Customize the email content. Leave empty to use system default.
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-text-secondary">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : (
              <>
                {/* Subject Line */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2 bg-background border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                {/* Variable Cheat Sheet */}
                {template?.available_variables && template.available_variables.length > 0 && (
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-text-secondary">
                    <span className="font-semibold text-blue-600 block mb-1">Available Variables:</span>
                    <div className="flex flex-wrap gap-2">
                      {template.available_variables.map(v => (
                        <code 
                          key={v} 
                          className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-800 text-xs cursor-pointer hover:bg-blue-50"
                          onClick={() => {
                            navigator.clipboard.writeText(`{{${v}}}`);
                            // Ideally insert into editor, but clipboard is easy first step
                            alert(`Copied {{${v}}} to clipboard!`);
                          }}
                          title="Click to copy"
                        >
                          {`{{${v}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Editor */}
                <div className="border border-border rounded-lg overflow-hidden min-h-[400px] flex flex-col">
                  <RichTextEditor
                    content={content}
                    onChange={setContent}
                    placeholder="Write your email content here..."
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-surface-highlight rounded-b-xl flex justify-between items-center">
            
            {/* Left Actions */}
            <div className="flex gap-2">
               <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Revert to original system template"
              >
                <RefreshCw size={16} />
                <span className="hidden sm:inline">Reset to Default</span>
              </button>

              <div className="relative flex items-center">
                {showTestInput ? (
                   <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1 animate-in fade-in slide-in-from-left-5">
                      <input 
                        type="email" 
                        placeholder="your@email.com" 
                        value={testEmail}
                        onChange={e => setTestEmail(e.target.value)}
                        className="text-sm bg-transparent outline-none px-2 w-48 text-text-primary"
                      />
                      <button onClick={handleSendTest} className="p-1.5 bg-primary text-white rounded hover:bg-primary-hover">
                        <Send size={14} />
                      </button>
                      <button onClick={() => setShowTestInput(false)} className="p-1.5 text-text-secondary hover:text-text-primary">
                        <X size={14} />
                      </button>
                   </div>
                ) : (
                  <button 
                    onClick={() => setShowTestInput(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-black/5 rounded-lg transition-colors"
                  >
                    <Send size={16} />
                    <span className="hidden sm:inline">Send Test</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Template
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};