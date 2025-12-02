// src/pages/SetupWizard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CheckCircle2, Server, User, ArrowRight, Loader2 } from 'lucide-react';

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

      // Success! Force a full reload to pick up the new config (and likely redirect to login)
      window.location.href = '/auth';
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome to Subfloor</h1>
          <p className="text-slate-400">Let's get your system ready for business.</p>
        </div>

        <Card className="border-slate-800 bg-slate-900 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>1</div>
                <div className={`h-1 w-8 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-800'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>2</div>
              </div>
              <span className="text-sm font-medium text-slate-400">
                {step === 1 ? 'Create Admin' : 'System Config'}
              </span>
            </div>
            
            <CardTitle className="text-xl text-white">
              {step === 1 ? 'Create Admin Account' : 'Company Settings'}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {step === 1 
                ? 'This user will have full access to all settings.' 
                : 'Configure how your team will access the system.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded text-sm text-red-200">
                {error}
              </div>
            )}

            {step === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-slate-200">First Name</Label>
                    <Input 
                      id="firstName" name="firstName" 
                      value={formData.firstName} onChange={handleChange}
                      className="bg-slate-950 border-slate-800 text-white" 
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-slate-200">Last Name</Label>
                    <Input 
                      id="lastName" name="lastName" 
                      value={formData.lastName} onChange={handleChange}
                      className="bg-slate-950 border-slate-800 text-white" 
                      placeholder="Doe"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">Email Address</Label>
                  <Input 
                    id="email" name="email" type="email"
                    value={formData.email} onChange={handleChange}
                    className="bg-slate-950 border-slate-800 text-white" 
                    placeholder="admin@company.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-200">Password</Label>
                    <Input 
                      id="password" name="password" type="password"
                      value={formData.password} onChange={handleChange}
                      className="bg-slate-950 border-slate-800 text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-200">Confirm</Label>
                    <Input 
                      id="confirmPassword" name="confirmPassword" type="password"
                      value={formData.confirmPassword} onChange={handleChange}
                      className="bg-slate-950 border-slate-800 text-white" 
                    />
                  </div>
                </div>

                <Button onClick={handleNext} className="w-full mt-4 bg-blue-600 hover:bg-blue-500">
                  Next Step <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-slate-200">Company Name</Label>
                  <Input 
                    id="companyName" name="companyName" 
                    value={formData.companyName} onChange={handleChange}
                    className="bg-slate-950 border-slate-800 text-white" 
                    placeholder="My Flooring Co."
                  />
                  <p className="text-xs text-slate-500">This will appear on emails and invoices.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publicUrl" className="text-slate-200">System URL</Label>
                  <Input 
                    id="publicUrl" name="publicUrl" 
                    value={formData.publicUrl} onChange={handleChange}
                    className="bg-slate-950 border-slate-800 text-white" 
                  />
                  <div className="flex items-start gap-2 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <p className="text-xs text-slate-500">
                      We detected <strong>{window.location.origin}</strong>. Change this only if you are setting up behind a proxy/domain.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                    Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading} className="w-2/3 bg-green-600 hover:bg-green-500 text-white">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Server className="w-4 h-4 mr-2" />}
                    Initialize System
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}