import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Project, Job, Quote, ChangeOrder, ProjectStatus, QuoteStatus, JobAppointment } from '../types';
import { Save, Calendar, AlertTriangle, PlusCircle, XCircle, Move } from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- HELPER FUNCTIONS ---
const formatDateForInput = (dateString: string | undefined | null): string => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
};

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

// --- MAIN COMPONENT ---
const FinalizeJobSection: React.FC<FinalizeJobSectionProps> = ({ project, job, quotes, changeOrders, saveJobDetails, updateProject }) => {
    // --- DATA & STATE ---
    const { installers } = useData();

    // Track if we have initialized to prevent aggressive overwrites
    const isInitialized = useRef(false);

    const [jobDetails, setJobDetails] = useState<Partial<Job>>({
        projectId: project.id,
        poNumber: '',
        depositReceived: false,
        contractsReceived: false,
        finalPaymentReceived: false,
        isOnHold: false,
        appointments: []
    });
    
    // --- MEMOIZED VALUES ---
    const acceptedQuotes = useMemo(() => quotes.filter(q => q.status === QuoteStatus.ACCEPTED), [quotes]);
    
    // Helper to get the default installer from the accepted quote
    const defaultInstallerId = useMemo(() => {
        return acceptedQuotes.length > 0 ? acceptedQuotes[0].installerId : null;
    }, [acceptedQuotes]);

    const isSchedulingApplicable = useMemo(() => {
        if (acceptedQuotes.length === 0) return false;
        return acceptedQuotes.some(q => q.installationType === 'Managed Installation' || q.installationType === 'Unmanaged Installer');
    }, [acceptedQuotes]);

    const financialSummary = useMemo(() => {
        const quoteFinancials = acceptedQuotes.map((quote) => {
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
            return { subtotal, deposit };
        });
        const unassignedChangeOrdersTotal = changeOrders.filter(co => co.quoteId == null).reduce((sum, co) => sum + (Number(co.amount) || 0), 0);
        const grandTotal = quoteFinancials.reduce((sum, qf) => sum + qf.subtotal, 0) + unassignedChangeOrdersTotal;
        const totalDeposit = quoteFinancials.reduce((sum, qf) => sum + qf.deposit, 0);
        const balanceDue = grandTotal - totalDeposit;
        return { grandTotal, totalDeposit, balanceDue };
    }, [acceptedQuotes, changeOrders]);

    // --- EFFECTS ---
    useEffect(() => {
        if (job) {
            // GUARD: Prevent overwrite by empty updates
            const incomingHasAppointments = Array.isArray(job.appointments) && job.appointments.length > 0;
            const localHasAppointments = Array.isArray(jobDetails.appointments) && jobDetails.appointments.length > 0;

            if (isInitialized.current && localHasAppointments && !incomingHasAppointments) {
                return;
            }

            setJobDetails({
                ...job,
                projectId: project.id,
                appointments: (job.appointments || []).map(a => ({ ...a, _tempId: a.id || tempAppointmentId++ })),
            });
            isInitialized.current = true;
        } else if (!isInitialized.current) {
            // Initial Fallback
            setJobDetails({
                projectId: project.id,
                poNumber: '',
                depositReceived: false,
                contractsReceived: false,
                finalPaymentReceived: false,
                isOnHold: false,
                appointments: [{
                    _tempId: tempAppointmentId++,
                    appointmentName: 'Installation',
                    installerId: defaultInstallerId, // PRE-FILL ON INITIAL LOAD
                    startDate: '',
                    endDate: '',
                }]
            });
            isInitialized.current = true;
        }
    }, [job, project.id, acceptedQuotes, defaultInstallerId]);
    
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
            installerId: defaultInstallerId, // PRE-FILL ON ADD BUTTON
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

        const { appointments, ...coreJobDetails } = jobDetails;
        const finalAppointments = (appointments || []).map(({ _tempId, ...rest }) => rest);

        try {
            await saveJobDetails({ 
                ...coreJobDetails, 
                depositAmount: financialSummary.totalDeposit,
                appointments: finalAppointments 
            });

            if (shouldUpdateStatus) {
                await updateProject({ id: project.id, status: ProjectStatus.SCHEDULED });
            }
            
            toast.success("Job details saved successfully.");
            
        } catch (error) { 
            console.error("Failed to save job details", error);
            toast.error("Failed to save job details. Please try again.");
        }
    };
    
    const isScheduledOrLater = project.status === ProjectStatus.SCHEDULED || project.status === ProjectStatus.COMPLETED;

    return (
        <div className="bg-surface rounded-lg shadow-md flex flex-col h-full">
            <div className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <Calendar className="w-6 h-6 text-accent"/>
                    <h2 className="text-xl font-semibold text-text-primary">Job Details & Scheduling</h2>
                </div>
                <button onClick={handleSave} className="bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                    <Save className="w-4 h-4"/> Save Details
                </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 flex-grow overflow-hidden">
                <div className="space-y-6 overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">PO Number</label>
                        <input type="text" value={jobDetails.poNumber || ''} onChange={e => handleJobChange('poNumber', e.target.value)} className="w-full p-2 bg-background border-border rounded text-text-primary"/>
                    </div>
                    
                    <div className="flex items-center space-x-3 bg-background p-3 rounded-md">
                        <input
                            type="checkbox"
                            id="isOnHold"
                            checked={jobDetails.isOnHold || false}
                            onChange={e => handleJobChange('isOnHold', e.target.checked)}
                            className="h-5 w-5 rounded text-primary focus:ring-primary bg-surface border-border"
                        />
                        <label htmlFor="isOnHold" className="font-semibold text-yellow-400 flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Place Job ON HOLD
                        </label>
                    </div>

                    {isSchedulingApplicable && (
                        <div className="space-y-4">
                            {(jobDetails.appointments || []).map((appt) => (
                                <div key={appt._tempId} className="bg-background p-4 rounded-lg border border-border relative">
                                    { (jobDetails.appointments?.length || 0) > 1 && (
                                        <button onClick={() => removeAppointment(appt._tempId)} className="absolute -top-2 -right-2 text-text-secondary hover:text-red-500">
                                            <XCircle />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Appointment Name</label>
                                            <input type="text" value={appt.appointmentName} onChange={e => handleAppointmentChange(appt._tempId, 'appointmentName', e.target.value)} className="w-full p-2 text-sm bg-surface border-border rounded text-text-primary" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                                            <input type="date" value={formatDateForInput(appt.startDate)} onChange={e => handleAppointmentChange(appt._tempId, 'startDate', e.target.value)} className="w-full p-2 text-sm bg-surface border-border rounded text-text-primary"/>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
                                            <input type="date" value={formatDateForInput(appt.endDate)} onChange={e => handleAppointmentChange(appt._tempId, 'endDate', e.target.value)} className="w-full p-2 text-sm bg-surface border-border rounded text-text-primary"/>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Assigned Installer</label>
                                            <select value={appt.installerId || ''} onChange={e => handleAppointmentChange(appt._tempId, 'installerId', e.target.value ? parseInt(e.target.value) : null)} className="w-full p-2 text-sm bg-surface border-border rounded text-text-primary">
                                                <option value="">-- Select Installer --</option>
                                                {installers.map(installer => (
                                                    <option key={installer.id} value={installer.id}>{installer.installerName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={addAppointment} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover py-2 border-2 border-dashed border-border hover:border-primary rounded-lg transition-colors">
                                <PlusCircle size={16} /> Add Appointment
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-4 flex flex-col overflow-y-auto pr-2">
                    <div className="bg-background p-4 rounded-lg space-y-2 border border-border">
                        <div className="flex justify-between items-center font-bold text-lg"><span className="text-text-primary">Job Grand Total:</span><span className="text-text-primary">${financialSummary.grandTotal.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-semibold"><span className="text-text-secondary">Total Deposit Required:</span><span className="text-text-primary">${financialSummary.totalDeposit.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-bold text-lg border-t-2 border-accent pt-2 mt-2"><span className="text-text-primary">Balance Due:</span><span className="text-accent">${financialSummary.balanceDue.toFixed(2)}</span></div> 
                    </div>
                
                    <div className="pt-2 space-y-3 flex-grow"> 
                        <label className={`flex items-center space-x-2 ${isScheduledOrLater ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={jobDetails.depositReceived || false} onChange={e => handleJobChange('depositReceived', e.target.checked)} disabled={isScheduledOrLater} className="form-checkbox h-5 w-5 text-primary bg-background border-border rounded focus:ring-primary"/>
                            <span className="text-text-primary">Deposit Received</span>
                        </label> 
                        <label className={`flex items-center space-x-2 ${isScheduledOrLater ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={jobDetails.contractsReceived || false} onChange={e => handleJobChange('contractsReceived', e.target.checked)} disabled={isScheduledOrLater} className="form-checkbox h-5 w-5 text-primary bg-background border-border rounded focus:ring-primary"/>
                            <span className="text-text-primary">Contracts Received</span>
                        </label> 
                        {isScheduledOrLater && (
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={jobDetails.finalPaymentReceived || false} onChange={e => handleJobChange('finalPaymentReceived', e.target.checked)} className="form-checkbox h-5 w-5 text-primary bg-background border-border rounded focus:ring-primary"/>
                                <span className="text-text-primary">Final Payment Received</span>
                            </label>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalizeJobSection;