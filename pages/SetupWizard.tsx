import React, { useState, useEffect } from 'react';
import { CheckCircle2, Server, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

export default function SetupWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSecure, setIsSecure] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    publicUrl: window.location.origin
  });

  useEffect(() => {
      fetch('/api/setup/status')
          .then(res => res.json())
          .then(data => {
              if (data.isSupertokensSecure === false) setIsSecure(false);
          })
          .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = () => {
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
      if (!res.ok) throw new Error(data.error || "Setup failed");

      window.location.href = '/auth';
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent placeholder-neutral-500";
  const labelClasses = "block text-sm font-medium text-neutral-400 mb-1.5";

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans text-neutral-200">
      <div className="w-full max-w-lg">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-100 mb-2 tracking-tight">Welcome to Subfloor</h1>
          <p className="text-neutral-400">Let's get your system ready for business.</p>
        </div>

        {/* SECURITY WARNING BANNER */}
        {!isSecure && (
            <div className="mb-6 bg-warning-container/20 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm text-neutral-200">
                    <strong className="block text-warning mb-1 font-bold">Security Warning: No API Key Detected</strong>
                    Your authentication service is running in insecure mode. Please add <code className="bg-black/30 px-1 rounded">SUPERTOKENS_API_KEY</code> to your environment variables and restart.
                </div>
            </div>
        )}

        {/* Card Container */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Card Header */}
          <div className="p-6 border-b border-neutral-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 1 ? 'bg-primary text-on-primary shadow-sm' : 'bg-neutral-800 text-neutral-500'}`}>1</div>
                <div className={`h-1 w-8 transition-colors ${step >= 2 ? 'bg-primary' : 'bg-neutral-800'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 2 ? 'bg-primary text-on-primary shadow-sm' : 'bg-neutral-800 text-neutral-500'}`}>2</div>
              </div>
              <span className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                {step === 1 ? 'Create Admin' : 'System Config'}
              </span>
            </div>
            
            <h2 className="text-xl font-bold text-neutral-100">
              {step === 1 ? 'Create Admin Account' : 'Company Settings'}
            </h2>
            <p className="text-sm text-neutral-400 mt-1 font-medium">
              {step === 1 
                ? 'This user will have full access to all settings.' 
                : 'Configure how your team will access the system.'}
            </p>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
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
                  className="w-full mt-4 bg-primary hover:bg-primary-hover text-on-primary font-bold py-3 px-6 rounded-full transition-all shadow-md flex items-center justify-center"
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
                  <p className="text-xs text-neutral-500 mt-1 font-medium">This will appear on emails and invoices.</p>
                </div>

                <div>
                  <label htmlFor="publicUrl" className={labelClasses}>System URL</label>
                  <input 
                    id="publicUrl" name="publicUrl" type="text"
                    value={formData.publicUrl} onChange={handleChange}
                    className={inputClasses} 
                  />
                  <div className="flex items-start gap-2 mt-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                      We detected <strong>{window.location.origin}</strong>. Only change this if you are using a proxy or custom domain.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setStep(1)} 
                    className="w-1/3 py-3 px-4 text-neutral-400 font-bold hover:text-neutral-100 hover:bg-neutral-800 rounded-full transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={loading} 
                    className="w-2/3 bg-success hover:bg-success-hover text-on-success font-bold py-3 px-6 rounded-full transition-all shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Server className="w-5 h-5 mr-2" />}
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