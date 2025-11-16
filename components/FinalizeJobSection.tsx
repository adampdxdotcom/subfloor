import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Project, Job, Quote, ChangeOrder, ProjectStatus, QuoteStatus, JobAppointment, Installer } from '../types';
import { Save, Calendar, AlertTriangle, CheckCircle2, PlusCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast'; // --- ADDED: Import for user notifications

// --- HELPER FUNCTIONS ---
const formatDateForInput = (dateString: string | undefined | null): string => {
    if (!dateString) return '';
    // Handles both ISO strings and "YYYY-MM-DD" formats
    return new Date(dateString).toISOString().split('T')[0];
};

// A unique ID for new, unsaved appointments so React can track them
let tempAppointmentId = 0;

// --- COMPONENT PROPS ---
interface FinalizeJobSectionProps {
    project: Project;
    job: Job | undefined;
    quotes: Quote[];
    changeOrders: ChangeOrder[];
    saveJobDetails: (job: Partial<Job>) => Promise<void>;
    updateProject: (p: Partial<Project> & { id: number }) => void;
}

interface QuoteFinancials {
    quote: Quote;
    quoteIndex: number;
    subtotal: number;
    deposit: number;
}

// --- MAIN COMPONENT ---
const FinalizeJobSection: React.FC<FinalizeJobSectionProps> = ({ project, job, quotes, changeOrders, saveJobDetails, updateProject }) => {
    // --- DATA & STATE ---
    const { installers } = useData(); // Get installers for the dropdown

    const [jobDetails, setJobDetails] = useState<Partial<Job>>({
        projectId: project.id,
        poNumber: '',
        depositReceived: false,
        contractsReceived: false,
        finalPaymentReceived: false,
        isOnHold: false,
        notes: '',
        appointments: [] // Start with an empty appointments array
    });
    
    // --- MEMOIZED VALUES ---
    const acceptedQuotes = useMemo(() => quotes.filter(q => q.status === QuoteStatus.ACCEPTED), [quotes]);
    
    // Determine if the job requires scheduling UI (i.e., it's not "Materials Only")
    const isSchedulingApplicable = useMemo(() => {
        if (acceptedQuotes.length === 0) return false;
        return acceptedQuotes.some(q => q.installationType === 'Managed Installation' || q.installationType === 'Unmanaged Installer');
    }, [acceptedQuotes]);

    // Financial calculations remain largely the same
    const financialSummary = useMemo(() => {
        const quoteFinancials = acceptedQuotes.map((quote, index) => {
            const baseTotal = (Number(quote.materialsAmount) || 0) + (Number(quote.laborAmount) || 0);
            const associatedChangeOrders = changeOrders.filter(co => co.quoteId === quote.id);
            const changeOrdersTotal = associatedChangeOrders.reduce((sum, co) => sum + (Number(co.amount) || 0), 0);
            const subtotal = baseTotal + changeOrdersTotal;
            const depositPercent = quote.installationType === 'Managed Installation' ? (Number(quote.laborDepositPercentage) || 0) / 100 : 0;
            const quoteDeposit = (Number(quote.materialsAmount) || 0) + ((Number(quote.laborAmount) || 0) * depositPercent);
            const changeOrderDeposit = associatedChangeOrders.reduce((sum, co) => {
                const amount = Number(co.amount) || 0;
                return sum + (co.type === 'Materials' ? amount : amount * depositPercent);
            }, 0);
            const deposit = quoteDeposit + changeOrderDeposit;
            return { quote, quoteIndex: index + 1, subtotal, deposit };
        });
        const unassignedChangeOrdersTotal = changeOrders.filter(co => co.quoteId == null).reduce((sum, co) => sum + (Number(co.amount) || 0), 0);
        const grandTotal = quoteFinancials.reduce((sum, qf) => sum + qf.subtotal, 0) + unassignedChangeOrdersTotal;
        const totalDeposit = quoteFinancials.reduce((sum, qf) => sum + qf.deposit, 0);
        const balanceDue = grandTotal - totalDeposit;
        return { grandTotal, totalDeposit, balanceDue };
    }, [acceptedQuotes, changeOrders]);

    // --- EFFECTS ---
    // Effect to initialize or update the form when the job data changes
    useEffect(() => {
        if (job) {
            // If we have a job, populate the state
            setJobDetails({
                ...job,
                projectId: project.id,
                // Ensure appointments have a temporary unique key for React's map function
                appointments: job.appointments.map(a => ({ ...a, _tempId: a.id || tempAppointmentId++ })),
            });
        } else {
            // If no job exists, create a default state with one empty appointment
            setJobDetails({
                projectId: project.id,
                poNumber: '',
                depositReceived: false,
                contractsReceived: false,
                finalPaymentReceived: false,
                isOnHold: false,
                notes: '',
                appointments: [{
                    _tempId: tempAppointmentId++,
                    appointmentName: 'Installation',
                    installerId: acceptedQuotes[0]?.installerId || null,
                    startDate: '',
                    endDate: '',
                }]
            });
        }
    }, [job, project.id, acceptedQuotes]);
    
    // --- HANDLERS ---
    const handleJobChange = (field: keyof Job, value: any) => {
        setJobDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleAppointmentChange = (tempId: number, field: keyof JobAppointment, value: any) => {
        setJobDetails(prev => ({
            ...prev,
            appointments: (prev.appointments || []).map(appt =>
                appt._tempId === tempId ? { ...appt, [field]: value } : appt
            )
        }));
    };

    const addAppointment = () => {
        const newAppointment = {
            _tempId: tempAppointmentId++,
            appointmentName: `Part ${ (jobDetails.appointments?.length || 0) + 1}`,
            installerId: null,
            startDate: '',
            endDate: '',
        };
        setJobDetails(prev => ({ ...prev, appointments: [...(prev.appointments || []), newAppointment] }));
    };
    
    const removeAppointment = (tempId: number) => {
        setJobDetails(prev => ({
            ...prev,
            appointments: (prev.appointments || []).filter(appt => appt._tempId !== tempId)
        }));
    };

    const handleSave = async () => {
        const firstAppointment = jobDetails.appointments?.[0];
        const shouldUpdateStatus = project.status === ProjectStatus.ACCEPTED && isSchedulingApplicable;
        
        if (shouldUpdateStatus && (!firstAppointment || !firstAppointment.startDate)) {
            toast.error("Please enter a Start Date for the first appointment to schedule the job.");
            return;
        }

        // --- START: THE FIX ---

        // 1. Isolate the core job properties by destructuring 'appointments' out.
        const { appointments, ...coreJobDetails } = jobDetails;

        // 2. Create the clean array of appointments, stripping the temp UI key and handling potential undefined.
        const finalAppointments = (appointments || []).map(({ _tempId, ...rest }) => rest);

        try {
            // 3. Build the payload explicitly from the clean parts.
            await saveJobDetails({ 
                ...coreJobDetails, 
                depositAmount: financialSummary.totalDeposit,
                appointments: finalAppointments 
            });
        // --- END: THE FIX ---

            if (shouldUpdateStatus) {
                await updateProject({ id: project.id, status: ProjectStatus.SCHEDULED });
            }
        } catch (error) { 
            console.error("Failed to save job details", error);
            // Error toast is handled in the context
        }
    };
    
    // --- RENDER LOGIC ---
    const isScheduledOrLater = project.status === ProjectStatus.SCHEDULED || project.status === ProjectStatus.COMPLETED;
    const canSaveSchedule = jobDetails.depositReceived && jobDetails.contractsReceived && (isSchedulingApplicable ? (jobDetails.appointments?.[0]?.startDate) : true);

    return (
        <div className="bg-surface p-6 rounded-lg shadow-lg mt-8 relative">
            <h2 className="text-2xl font-semibold text-text-primary mb-6 flex items-center">
                <Calendar className="w-6 h-6 mr-3 text-accent"/>
                Job Details & Scheduling
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* --- LEFT COLUMN: JOB INFO & APPOINTMENTS --- */}
                <div className="space-y-6 flex flex-col">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">PO Number</label>
                        <input type="text" value={jobDetails.poNumber || ''} onChange={e => handleJobChange('poNumber', e.target.value)} className="w-full p-2 bg-gray-800 border-border rounded"/>
                    </div>
                    
                    <div className="flex items-center space-x-3 bg-gray-800 p-3 rounded-md">
                        <input
                            type="checkbox"
                            id="isOnHold"
                            checked={jobDetails.isOnHold || false}
                            onChange={e => handleJobChange('isOnHold', e.target.checked)}
                            className="h-5 w-5 rounded text-accent focus:ring-accent bg-gray-700 border-gray-600"
                        />
                        <label htmlFor="isOnHold" className="font-semibold text-yellow-400 flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Place Job ON HOLD
                        </label>
                    </div>

                    {isSchedulingApplicable && (
                        <div className="space-y-4">
                            {(jobDetails.appointments || []).map((appt, index) => (
                                <div key={appt._tempId} className="bg-gray-800 p-4 rounded-lg border border-border relative">
                                    { (jobDetails.appointments?.length || 0) > 1 && (
                                        <button onClick={() => removeAppointment(appt._tempId)} className="absolute -top-2 -right-2 text-gray-500 hover:text-red-500">
                                            <XCircle />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Appointment Name</label>
                                            <input type="text" value={appt.appointmentName} onChange={e => handleAppointmentChange(appt._tempId, 'appointmentName', e.target.value)} className="w-full p-2 text-sm bg-gray-900 border-border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                                            <input type="date" value={formatDateForInput(appt.startDate)} onChange={e => handleAppointmentChange(appt._tempId, 'startDate', e.target.value)} className="w-full p-2 text-sm bg-gray-900 border-border rounded"/>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
                                            <input type="date" value={formatDateForInput(appt.endDate)} onChange={e => handleAppointmentChange(appt._tempId, 'endDate', e.target.value)} className="w-full p-2 text-sm bg-gray-900 border-border rounded"/>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Assigned Installer</label>
                                            <select value={appt.installerId || ''} onChange={e => handleAppointmentChange(appt._tempId, 'installerId', e.target.value ? parseInt(e.target.value) : null)} className="w-full p-2 text-sm bg-gray-900 border-border rounded">
                                                <option value="">-- Select Installer --</option>
                                                {installers.map(installer => (
                                                    <option key={installer.id} value={installer.id}>{installer.installerName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={addAppointment} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-accent hover:text-purple-300 py-2 border-2 border-dashed border-border hover:border-accent rounded-lg transition-colors">
                                <PlusCircle size={16} /> Add Appointment
                            </button>
                        </div>
                    )}

                    <div className="flex-grow flex flex-col">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                        <textarea value={jobDetails.notes || ''} onChange={e => handleJobChange('notes', e.target.value)} className="w-full p-2 bg-gray-800 border-border rounded flex-grow min-h-[100px]" rows={4}></textarea>
                    </div>
                </div>

                {/* --- RIGHT COLUMN: FINANCIALS & CHECKLIST --- */}
                <div className="space-y-4 flex flex-col">
                    <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between items-center font-bold text-lg"><span className="text-text-primary">Job Grand Total:</span><span>${financialSummary.grandTotal.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-semibold"><span className="text-text-secondary">Total Deposit Required:</span><span className="text-text-primary">${financialSummary.totalDeposit.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-bold text-lg border-t-2 border-accent pt-2 mt-2"><span className="text-text-primary">Balance Due:</span><span className="text-accent">${financialSummary.balanceDue.toFixed(2)}</span></div> 
                    </div>
                
                    <div className="pt-2 space-y-3 flex-grow"> 
                        <label className={`flex items-center space-x-2 ${isScheduledOrLater ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={jobDetails.depositReceived || false} onChange={e => handleJobChange('depositReceived', e.target.checked)} disabled={isScheduledOrLater} className="form-checkbox h-5 w-5 text-accent bg-gray-800 border-border rounded focus:ring-accent"/>
                            <span className="text-text-primary">Deposit Received</span>
                        </label> 
                        <label className={`flex items-center space-x-2 ${isScheduledOrLater ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={jobDetails.contractsReceived || false} onChange={e => handleJobChange('contractsReceived', e.target.checked)} disabled={isScheduledOrLater} className="form-checkbox h-5 w-5 text-accent bg-gray-800 border-border rounded focus:ring-accent"/>
                            <span className="text-text-primary">Contracts Received</span>
                        </label> 
                        {isScheduledOrLater && (
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={jobDetails.finalPaymentReceived || false} onChange={e => handleJobChange('finalPaymentReceived', e.target.checked)} className="form-checkbox h-5 w-5 text-accent bg-gray-800 border-border rounded focus:ring-accent"/>
                                <span className="text-text-primary">Final Payment Received</span>
                            </label>
                        )}
                    </div>
                </div>
            </div>

            {/* --- ACTION BUTTONS --- */}
            <div className="md:col-span-2 text-right mt-6 pt-6 border-t border-border space-x-4">
                <button onClick={handleSave} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg">
                    <Save className="w-4 h-4 mr-2 inline-block"/> Save Changes
                </button>
                {/* Note: Logic for "Mark as Complete" could be added here later */}
            </div>
        </div>
    );
};

export default FinalizeJobSection;