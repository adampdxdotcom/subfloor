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
    const { installers } = useData();
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
    
    const isSchedulingApplicable = useMemo(() => {
        if (acceptedQuotes.length === 0) return false;
        return acceptedQuotes.some(q => q.installationType === 'Managed Installation' || q.installationType === 'Unmanaged Installer');
    }, [acceptedQuotes]);

    const isManagedJob = useMemo(() => {
        return acceptedQuotes.some(q => q.installationType === 'Managed Installation');
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
                    quoteId: acceptedQuotes.length === 1 ? acceptedQuotes[0].id : undefined,
                    installerId: acceptedQuotes.length === 1 ? acceptedQuotes[0].installerId : null,
                    startDate: '',
                    endDate: '',
                }]
            });
            isInitialized.current = true;
        }
    }, [job, project.id, acceptedQuotes]);
    
    useEffect(() => {
        if (acceptedQuotes.length === 1 && jobDetails.appointments) {
            const singleQuoteId = acceptedQuotes[0].id;
            const needsUpdate = jobDetails.appointments.some(a => a.quoteId !== singleQuoteId);
            if (needsUpdate) {
                setJobDetails(prev => ({
                    ...prev,
                    appointments: (prev.appointments || []).map(a => ({
                        ...a,
                        quoteId: singleQuoteId,
                        installerId: acceptedQuotes[0].installerId
                    }))
                }));
            }
        }
    }, [acceptedQuotes, jobDetails.appointments]);

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

    const handleQuoteSelection = (tempId: number, quoteIdStr: string) => {
        const quoteId = quoteIdStr ? parseInt(quoteIdStr) : null;
        const selectedQuote = acceptedQuotes.find(q => q.id === quoteId);
        
        setJobDetails(prev => ({
            ...prev,
            appointments: (prev.appointments || []).map(appt =>
                appt._tempId === tempId ? { 
                    ...appt, 
                    quoteId: quoteId,
                    installerId: selectedQuote?.installerId || null 
                } : appt
            )
        }));
    };

    const addAppointment = () => {
        const newAppointment = {
            _tempId: tempAppointmentId++,
            appointmentName: `Part ${ (jobDetails.appointments?.length || 0) + 1}`,
            quoteId: acceptedQuotes.length === 1 ? acceptedQuotes[0].id : undefined,
            installerId: acceptedQuotes.length === 1 ? acceptedQuotes[0].installerId : null,
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
        
        if (isSchedulingApplicable && jobDetails.appointments?.some(a => !a.quoteId)) {
            toast.error("All appointments must be linked to an Accepted Quote (Scope of Work).");
            return;
        }

        if (shouldUpdateStatus && isManagedJob) {
            if (!jobDetails.depositReceived || !jobDetails.contractsReceived) {
                toast.error("Deposit and Contracts must be marked as received before scheduling a Managed Job.");
                return;
            }
        }

        const { appointments, ...coreJobDetails } = jobDetails;
        const finalAppointments = (appointments || []).map(({ _tempId, startDate, endDate, ...rest }) => ({
            ...rest,
            startDate: startDate && !startDate.includes('T') ? `${startDate}T12:00:00` : startDate,
            endDate: endDate && !endDate.includes('T') ? `${endDate}T12:00:00` : endDate
        }));

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
            toast.error("Failed to save job details. Please try again.");
        }
    };
    
    const toggleHold = () => {
        handleJobChange('isOnHold', !jobDetails.isOnHold);
    };

    const finalPaymentUnlockDate = useMemo(() => {
        if (!jobDetails.appointments || jobDetails.appointments.length === 0) return null;
        const dates = jobDetails.appointments
            .map(a => a.endDate ? new Date(a.endDate).getTime() : 0)
            .sort((a, b) => b - a);
        return dates[0] > 0 ? new Date(dates[0]) : null;
    }, [jobDetails.appointments]);

    const canReceiveFinalPayment = !finalPaymentUnlockDate ? false : new Date() >= finalPaymentUnlockDate;
    const isLockedForSchedule = (project.status === ProjectStatus.SCHEDULED || project.status === ProjectStatus.COMPLETED);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-outline/10 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
                    <Calendar className="w-6 h-6 text-primary"/>
                    <h2 className="text-xl font-semibold text-text-primary">Job Details & Scheduling</h2>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={toggleHold}
                        className={`font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition-colors text-sm ${
                            jobDetails.isOnHold 
                                ? 'bg-tertiary-container text-on-tertiary-container' 
                                : 'border border-outline text-text-primary hover:bg-surface-container-highest'
                        }`}
                    >
                        <AlertTriangle className="w-4 h-4"/> {jobDetails.isOnHold ? 'ON HOLD' : 'Place Hold'}
                    </button>
                    <button onClick={handleSave} className="bg-primary hover:bg-primary-hover text-on-primary font-semibold py-2 px-4 rounded-full flex items-center gap-2 text-sm">
                        <Save className="w-4 h-4"/> Save Details
                    </button>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 flex-grow overflow-hidden">
                <div className="space-y-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-surface-container-highest">
                    {isSchedulingApplicable && (
                        <div className="space-y-3">
                            {acceptedQuotes.length === 0 && (
                                <div className="p-3 bg-error-container text-error border border-error rounded-lg flex items-center gap-2">
                                    <AlertTriangle size={20}/> Scheduling requires at least one accepted quote.
                                </div>
                            )}

                            {(jobDetails.appointments || []).map((appt) => {
                                const linkedQuote = acceptedQuotes.find(q => q.id === appt.quoteId);
                                return (
                                <div key={appt._tempId} className="bg-surface-container p-4 rounded-xl border border-outline/20 relative">
                                    { (jobDetails.appointments?.length || 0) > 1 && (
                                        <button onClick={() => removeAppointment(appt._tempId)} className="absolute -top-2 -right-2 text-text-secondary hover:text-error bg-surface-container-high p-0.5 rounded-full">
                                            <XCircle size={20}/>
                                        </button>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Appointment Name</label>
                                            <input type="text" value={appt.appointmentName} onChange={e => handleAppointmentChange(appt._tempId, 'appointmentName', e.target.value)} className="w-full bg-surface-container-low border border-outline/50 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                                            <input type="date" value={formatDateForInput(appt.startDate)} onChange={e => handleAppointmentChange(appt._tempId, 'startDate', e.target.value)} className="w-full bg-surface-container-low border border-outline/50 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"/>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
                                            <input type="date" value={formatDateForInput(appt.endDate)} onChange={e => handleAppointmentChange(appt._tempId, 'endDate', e.target.value)} className="w-full bg-surface-container-low border border-outline/50 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none"/>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-text-secondary mb-1">Scope of Work (via Quote)</label>
                                            {acceptedQuotes.length === 1 ? (
                                                <div className="w-full bg-surface-container-low border border-outline/50 rounded-lg px-3 py-2 text-sm text-text-primary font-medium">
                                                    {(() => {
                                                        const q = acceptedQuotes[0];
                                                        const i = installers.find(inst => inst.id === q.installerId);
                                                        return `${i?.installerName || 'Installer'} ${q.poNumber ? `(PO: ${q.poNumber})` : ''}`;
                                                    })()}
                                                </div>
                                            ) : (
                                                <select 
                                                    value={appt.quoteId ? String(appt.quoteId) : ''} 
                                                    onChange={e => handleQuoteSelection(appt._tempId, e.target.value)} 
                                                    className="w-full bg-surface-container-low border border-outline/50 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:ring-2 focus:ring-primary/50 outline-none cursor-pointer"
                                                    disabled={acceptedQuotes.length === 0}
                                                >
                                                    <option value="">-- Select Installer (Via Quote) --</option>
                                                    {acceptedQuotes.map(quote => {
                                                        const installer = installers.find(i => i.id === quote.installerId);
                                                        const installerName = installer ? installer.installerName : 'Unknown Installer';
                                                        const typeSuffix = quote.installationType !== 'Managed Installation' ? ` - ${quote.installationType}` : '';
                                                        const poSuffix = quote.poNumber ? ` (PO: ${quote.poNumber})` : '';
                                                        return (
                                                            <option key={quote.id} value={quote.id}>
                                                                {`${installerName}${poSuffix}${typeSuffix}`}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                            <button 
                                onClick={addAppointment} 
                                className={`w-full flex items-center justify-center gap-2 text-sm font-semibold py-2 border-2 border-dashed rounded-xl transition-colors ${
                                    acceptedQuotes.length > 0 
                                        ? 'text-primary hover:text-primary-hover border-outline/30 hover:border-primary/80 hover:bg-primary-container/20'
                                        : 'text-text-tertiary border-outline/20 opacity-50 cursor-not-allowed'
                                }`}
                                disabled={acceptedQuotes.length === 0}
                            >
                                <PlusCircle size={16} /> Add Appointment
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-4 flex flex-col overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-surface-container-highest">
                    <div className="bg-surface-container p-4 rounded-xl space-y-2 border border-outline/20">
                        <div className="flex justify-between items-center font-bold text-lg"><span className="text-text-primary">Job Grand Total:</span><span className="text-text-primary">${financialSummary.grandTotal.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-semibold"><span className="text-text-secondary">Total Deposit Required:</span><span className="text-text-primary">${financialSummary.totalDeposit.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-bold text-lg border-t-2 border-tertiary/50 pt-2 mt-2"><span className="text-text-primary">Balance Due:</span><span className="text-tertiary">${financialSummary.balanceDue.toFixed(2)}</span></div> 
                    </div>
                
                    {isManagedJob && (
                    <div className="pt-2 space-y-3 flex-grow"> 
                        <label className={`flex items-center space-x-2 ${isLockedForSchedule ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={jobDetails.depositReceived || false} onChange={e => handleJobChange('depositReceived', e.target.checked)} disabled={isLockedForSchedule} className="form-checkbox h-5 w-5 text-primary bg-surface-container border-outline/50 rounded focus:ring-primary"/>
                            <span className="text-text-primary">Deposit Received</span>
                        </label> 
                        <label className={`flex items-center space-x-2 ${isLockedForSchedule ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" checked={jobDetails.contractsReceived || false} onChange={e => handleJobChange('contractsReceived', e.target.checked)} disabled={isLockedForSchedule} className="form-checkbox h-5 w-5 text-primary bg-surface-container border-outline/50 rounded focus:ring-primary"/>
                            <span className="text-text-primary">Contracts Received</span>
                        </label> 
                        
                        {isLockedForSchedule && (
                            <label className={`flex items-center space-x-2 ${canReceiveFinalPayment ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`} title={!canReceiveFinalPayment ? `Available after ${finalPaymentUnlockDate?.toLocaleDateString()}` : ''}>
                                <input type="checkbox" 
                                    checked={jobDetails.finalPaymentReceived || false} 
                                    onChange={e => handleJobChange('finalPaymentReceived', e.target.checked)} 
                                    disabled={!canReceiveFinalPayment}
                                    className="form-checkbox h-5 w-5 text-primary bg-surface-container border-outline/50 rounded focus:ring-primary"/>
                                <span className="text-text-primary">Final Payment Received</span>
                            </label>
                        )}
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FinalizeJobSection;