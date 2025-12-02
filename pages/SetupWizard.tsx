// src/pages/SetupWizard.tsx
import React, { useState } from 'react';
import { CheckCircle2, Server, ArrowRight, Loader2 } from 'lucide-react';

export default function SetupWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    publicUrl: window.location.origin // Auto-detect current URL
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = () => {
    // Basic Validation for Step 1
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
        setError("All fields are required.");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!formData.companyName || !formData.publicUrl) {
      setError("Company Name and System URL are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Setup failed");
      }

      // Success! Force a full reload to pick up the new config
      window.location.href = '/auth';
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-slate-600";
  const labelClasses = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-lg">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome to Subfloor</h1>
          <p className="text-slate-400">Let's get your system ready for business.</p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
          
          {/* Card Header */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>1</div>
                <div className={`h-1 w-8 transition-colors ${step >= 2 ? 'bg-blue-600' : 'bg-slate-800'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>2</div>
              </div>
              <span className="text-sm font-medium text-slate-400">
                {step === 1 ? 'Create Admin' : 'System Config'}
              </span>
            </div>
            
            <h2 className="text-xl font-semibold text-white">
              {step === 1 ? 'Create Admin Account' : 'Company Settings'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {step === 1 
                ? 'This user will have full access to all settings.' 
                : 'Configure how your team will access the system.'}
            </p>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded text-sm text-red-200">
                {error}
              </div>
            )}

            {step === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className={labelClasses}>First Name</label>
                    <input 
                      id="firstName" name="firstName" type="text"
                      value={formData.firstName} onChange={handleChange}
                      className={inputClasses} placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={labelClasses}>Last Name</label>
                    <input 
                      id="lastName" name="lastName" type="text"
                      value={formData.lastName} onChange={handleChange}
                      className={inputClasses} placeholder="Doe"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className={labelClasses}>Email Address</label>
                  <input 
                    id="email" name="email" type="email"
                    value={formData.email} onChange={handleChange}
                    className={inputClasses} placeholder="admin@company.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className={labelClasses}>Password</label>
                    <input 
                      id="password" name="password" type="password"
                      value={formData.password} onChange={handleChange}
                      className={inputClasses} 
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className={labelClasses}>Confirm</label>
                    <input 
                      id="confirmPassword" name="confirmPassword" type="password"
                      value={formData.confirmPassword} onChange={handleChange}
                      className={inputClasses} 
                    />
                  </div>
                </div>

                <button 
                  onClick={handleNext} 
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  Next Step <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="companyName" className={labelClasses}>Company Name</label>
                  <input 
                    id="companyName" name="companyName" type="text"
                    value={formData.companyName} onChange={handleChange}
                    className={inputClasses} placeholder="My Flooring Co."
                  />
                  <p className="text-xs text-slate-500 mt-1">This will appear on emails and invoices.</p>
                </div>

                <div>
                  <label htmlFor="publicUrl" className={labelClasses}>System URL</label>
                  <input 
                    id="publicUrl" name="publicUrl" type="text"
                    value={formData.publicUrl} onChange={handleChange}
                    className={inputClasses} 
                  />
                  <div className="flex items-start gap-2 mt-2 bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-500">
                      We detected <strong>{window.location.origin}</strong>. Only change this if you are configuring a custom domain or proxy.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setStep(1)} 
                    className="w-1/3 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={loading} 
                    className="w-2/3 bg-green-600 hover:bg-green-500 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Server className="w-4 h-4 mr-2" />}
                    Initialize System
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}