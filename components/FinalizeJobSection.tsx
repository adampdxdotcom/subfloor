import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Project, Job, Quote, ChangeOrder, ProjectStatus, QuoteStatus } from '../types';
import { Save, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FinalizeJobSectionProps {
    project: Project;
    job: Job | undefined;
    quotes: Quote[];
    changeOrders: ChangeOrder[];
    saveJobDetails: (job: Partial<Job> & { projectId: number }) => Promise<void>;
    updateProject: (p: Partial<Project> & { id: number }) => void;
}

interface QuoteFinancials {
    quote: Quote;
    quoteIndex: number;
    baseTotal: number;
    changeOrders: ChangeOrder[];
    changeOrdersTotal: number;
    subtotal: number;
    deposit: number;
}

const formatDateForInput = (dateString: string | undefined | null) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';

const FinalizeJobSection: React.FC<FinalizeJobSectionProps> = ({ project, job, quotes, changeOrders, saveJobDetails, updateProject }) => {
    const { projects } = useData();
    const [scheduleConflicts, setScheduleConflicts] = useState<{ projectId: number; projectName: string; scheduledStartDate: string; scheduledEndDate: string | null; }[]>([]);
    
    const acceptedQuotes = useMemo(() => quotes.filter(q => q.status === QuoteStatus.ACCEPTED), [quotes]);
    
    const isSchedulingApplicable = useMemo(() => {
        if (acceptedQuotes.length === 0) return false;
        return acceptedQuotes.some(q => q.installationType === 'Managed Installation' || q.installationType === 'Unmanaged Installer');
    }, [acceptedQuotes]);

    const financialSummary = useMemo(() => {
        const quoteFinancials: QuoteFinancials[] = acceptedQuotes.map((quote, index) => {
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

            return { quote, quoteIndex: index + 1, baseTotal, changeOrders: associatedChangeOrders, changeOrdersTotal, subtotal, deposit };
        });

        const unassignedChangeOrders = changeOrders.filter(co => co.quoteId == null);
        const unassignedChangeOrdersTotal = unassignedChangeOrders.reduce((sum, co) => sum + (Number(co.amount) || 0), 0);
        
        const grandTotal = quoteFinancials.reduce((sum, qf) => sum + qf.subtotal, 0) + unassignedChangeOrdersTotal;
        const totalDeposit = quoteFinancials.reduce((sum, qf) => sum + qf.deposit, 0);
        const balanceDue = grandTotal - totalDeposit;

        return { quoteFinancials, unassignedChangeOrders, unassignedChangeOrdersTotal, grandTotal, totalDeposit, balanceDue };
    }, [acceptedQuotes, changeOrders]);
    
    const [jobDetails, setJobDetails] = useState({
        projectId: project.id,
        poNumber: '',
        depositReceived: false,
        contractsReceived: false,
        finalPaymentReceived: false,
        scheduledStartDate: '',
        scheduledEndDate: '',
        notes: ''
    });
    const [isCompletedOverlayVisible, setIsCompletedOverlayVisible] = useState(true);

    const installerId = acceptedQuotes.length > 0 ? acceptedQuotes[0].installerId : null;

    useEffect(() => {
        if (job) {
            setJobDetails({
                projectId: project.id,
                poNumber: job.poNumber || '',
                depositReceived: job.depositReceived || false,
                contractsReceived: job.contractsReceived || false,
                finalPaymentReceived: job.finalPaymentReceived || false,
                scheduledStartDate: formatDateForInput(job.scheduledStartDate),
                scheduledEndDate: formatDateForInput(job.scheduledEndDate),
                notes: job.notes || '',
            });
        } else {
            setJobDetails(prev => ({ ...prev, projectId: project.id, poNumber: '', depositReceived: false, contractsReceived: false, finalPaymentReceived: false, scheduledStartDate: '', scheduledEndDate: '', notes: '' }));
        }
    }, [job, project.id]);

    useEffect(() => {
        const checkConflicts = async () => {
            if (!isSchedulingApplicable || !jobDetails.scheduledStartDate || !installerId) {
                setScheduleConflicts([]); return;
            }
            try {
                const response = await fetch(`/api/installers/${installerId}/schedule?excludeProjectId=${project.id}`);
                const existingJobs: { projectId: number, scheduledStartDate: string, scheduledEndDate: string | null }[] = await response.json();
                const newStart = new Date(jobDetails.scheduledStartDate);
                const newEnd = jobDetails.scheduledEndDate ? new Date(jobDetails.scheduledEndDate) : newStart;
                
                const conflicts = existingJobs.filter(existingJob => {
                    const existingStart = new Date(existingJob.scheduledStartDate);
                    const existingEnd = existingJob.scheduledEndDate ? new Date(existingJob.scheduledEndDate) : existingStart;
                    return newStart <= existingEnd && newEnd >= existingStart;
                }).map(conflict => {
                    const conflictingProject = projects.find(p => p.id === conflict.projectId);
                    return { ...conflict, projectName: conflictingProject?.projectName || `Project #${conflict.projectId}` };
                });
                setScheduleConflicts(conflicts);
            } catch (error) { console.error("Failed to check for schedule conflicts:", error); }
        };
        checkConflicts();
    }, [jobDetails.scheduledStartDate, jobDetails.scheduledEndDate, installerId, project.id, projects, isSchedulingApplicable]);

    const isScheduledOrLater = project.status === ProjectStatus.SCHEDULED || project.status === ProjectStatus.COMPLETED;
    
    const handleSave = async () => {
        const shouldUpdateStatus = project.status === ProjectStatus.ACCEPTED && isSchedulingApplicable;
        if (shouldUpdateStatus && !jobDetails.scheduledStartDate) {
            alert("Please enter a Scheduled Start Date to schedule the job."); return;
        }
        try {
            await saveJobDetails({ ...jobDetails, depositAmount: financialSummary.totalDeposit });
            if (shouldUpdateStatus) {
                await updateProject({ id: project.id, status: ProjectStatus.SCHEDULED });
            }
        } catch (error) { console.error("Failed to save job details", error); }
    };
    
    const handleCompleteJob = async () => {
        if (!jobDetails.finalPaymentReceived) return;
        try {
            await saveJobDetails({ ...jobDetails, finalPaymentReceived: true, depositAmount: financialSummary.totalDeposit });
            await updateProject({ id: project.id, status: ProjectStatus.COMPLETED });
        } catch (error) { console.error("Failed to complete job", error); }
    };

    const canSaveSchedule = jobDetails.depositReceived && jobDetails.contractsReceived && (isSchedulingApplicable ? !!jobDetails.scheduledStartDate : true);
    const canCompleteJob = jobDetails.finalPaymentReceived;
    
    const JobDetailsForm = ( 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"> 
            <div className="space-y-6 flex flex-col"> 
                <div><label className="block text-sm font-medium text-text-secondary mb-1">PO Number</label><input type="text" value={jobDetails.poNumber} onChange={e => setJobDetails({...jobDetails, poNumber: e.target.value})} className="w-full p-2 bg-gray-800 border-border rounded"/></div> 
                {isSchedulingApplicable && (
                    <>
                        <div><label className="block text-sm font-medium text-text-secondary mb-1">Scheduled Start Date</label><input type="date" value={jobDetails.scheduledStartDate} onChange={e => setJobDetails({...jobDetails, scheduledStartDate: e.target.value})} className="w-full p-2 bg-gray-800 border-border rounded"/></div> 
                        <div><label className="block text-sm font-medium text-text-secondary mb-1">Scheduled End Date</label><input type="date" value={jobDetails.scheduledEndDate} onChange={e => setJobDetails({...jobDetails, scheduledEndDate: e.target.value})} className="w-full p-2 bg-gray-800 border-border rounded"/></div> 
                        {scheduleConflicts.length > 0 && ( <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm p-3 rounded-lg space-y-2"> <div className="flex items-center font-bold"> <AlertTriangle className="w-5 h-5 mr-2" /> Schedule Conflict Warning </div> <p>This installer is already scheduled for:</p> <ul className="list-disc pl-5 space-y-1"> {scheduleConflicts.map(conflict => ( <li key={conflict.projectId}> <Link to={`/projects/${conflict.projectId}`} className="font-semibold hover:underline">{conflict.projectName}</Link> <span className="text-xs ml-2">({new Date(conflict.scheduledStartDate).toLocaleDateString()} - {conflict.scheduledEndDate ? new Date(conflict.scheduledEndDate).toLocaleDateString() : '...'})</span> </li> ))} </ul> </div> )} 
                    </>
                )}
                <div className="flex-grow flex flex-col"><label className="block text-sm font-medium text-text-secondary mb-1">Notes</label><textarea value={jobDetails.notes} onChange={e => setJobDetails({...jobDetails, notes: e.target.value})} className="w-full p-2 bg-gray-800 border-border rounded flex-grow min-h-[100px]" rows={4}></textarea></div> 
            </div> 
            <div className="space-y-4 flex flex-col">
                <div className="bg-gray-800 p-4 rounded-lg space-y-4">
                    {financialSummary.quoteFinancials.map(({ quote, quoteIndex, changeOrders, subtotal }) => (
                        <div key={quote.id} className="border-b border-gray-700 last:border-b-0 pb-3 last:pb-0">
                            <h4 className="font-bold text-md text-text-primary mb-2">Quote #{quoteIndex} <span className="font-normal text-sm text-gray-400">- {quote.installationType}</span></h4>
                            <div className="pl-4 space-y-1">
                                <div className="flex justify-between items-center text-sm text-gray-300"><span>Base Materials:</span><span>${(Number(quote.materialsAmount) || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between items-center text-sm text-gray-300"><span>Base Labor:</span><span>${(Number(quote.laborAmount) || 0).toFixed(2)}</span></div>
                                {changeOrders.map((co, index) => ( <div key={`co-${index}`} className="flex justify-between items-center text-xs text-gray-400"><span>{co.description}:</span><span>${(Number(co.amount) || 0).toFixed(2)}</span></div> ))}
                                <div className="flex justify-between items-center font-semibold text-text-secondary pt-1 border-t border-gray-700 mt-1"><span>Subtotal:</span><span className="text-text-primary">${subtotal.toFixed(2)}</span></div>
                            </div>
                        </div>
                    ))}
                    {financialSummary.unassignedChangeOrders.length > 0 && (
                        <div className="border-b border-gray-700 last:border-b-0 pb-3 last:pb-0">
                            <h4 className="font-bold text-md text-yellow-400 mb-2">Unassigned Change Orders</h4>
                            <div className="pl-4 space-y-1">
                                {financialSummary.unassignedChangeOrders.map((co, index) => ( <div key={`un-co-${index}`} className="flex justify-between items-center text-xs text-yellow-300"><span>{co.description}:</span><span>${(Number(co.amount) || 0).toFixed(2)}</span></div> ))}
                            </div>
                        </div>
                    )}
                    <div className="pt-2 space-y-2">
                        <div className="flex justify-between items-center font-bold text-lg"><span className="text-text-primary">Job Grand Total:</span><span>${financialSummary.grandTotal.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-semibold"><span className="text-text-secondary">Total Deposit Required:</span><span className="text-text-primary">${financialSummary.totalDeposit.toFixed(2)}</span></div> 
                        <div className="flex justify-between items-center font-bold text-lg border-t-2 border-accent pt-2 mt-2"><span className="text-text-primary">Balance Due:</span><span className="text-accent">${financialSummary.balanceDue.toFixed(2)}</span></div> 
                    </div>
                </div>
                
                <div className="pt-2 space-y-3 flex-grow"> 
                    <label className={`flex items-center space-x-2 ${isScheduledOrLater ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><input type="checkbox" checked={jobDetails.depositReceived} onChange={e => setJobDetails({...jobDetails, depositReceived: e.target.checked})} disabled={isScheduledOrLater} className="form-checkbox h-5 w-5 text-accent bg-gray-800 border-border rounded focus:ring-accent"/><span className="text-text-primary">Deposit Received</span></label> 
                    <label className={`flex items-center space-x-2 ${isScheduledOrLater ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}><input type="checkbox" checked={jobDetails.contractsReceived} onChange={e => setJobDetails({...jobDetails, contractsReceived: e.target.checked})} disabled={isScheduledOrLater} className="form-checkbox h-5 w-5 text-accent bg-gray-800 border-border rounded focus:ring-accent"/><span className="text-text-primary">Contracts Received</span></label> 
                    {isScheduledOrLater && ( <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={jobDetails.finalPaymentReceived} onChange={e => setJobDetails({...jobDetails, finalPaymentReceived: e.target.checked})} className="form-checkbox h-5 w-5 text-accent bg-gray-800 border-border rounded focus:ring-accent"/><span className="text-text-primary">Final Payment Received</span></label> )} 
                </div> 
            </div> 
            <div className="md:col-span-2 text-right mt-2 space-x-4"> 
                {project.status === ProjectStatus.ACCEPTED && ( <button onClick={handleSave} disabled={!canSaveSchedule} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">{isSchedulingApplicable ? "Save Schedule" : "Save Job Details"}</button> )} 
                {project.status === ProjectStatus.SCHEDULED && ( <> <button onClick={handleSave} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg"><Save className="w-4 h-4 mr-2 inline-block"/> Save Changes</button> <button onClick={handleCompleteJob} disabled={!canCompleteJob} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">Mark as Complete</button> </> )} 
                {project.status === ProjectStatus.COMPLETED && ( <button onClick={handleSave} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg"><Save className="w-4 h-4 mr-2 inline-block"/> Save Changes</button> )} 
            </div>
        </div> 
    );
    const CompletedOverlay = ( <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-lg z-10"> <div className="text-center bg-surface p-8 rounded-lg shadow-2xl"> <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /> <h3 className="text-2xl font-bold text-text-primary">Job Completed</h3> <p className="text-text-secondary mt-2 mb-6">This project has been marked as complete.</p> <button onClick={() => setIsCompletedOverlayVisible(false)} className="bg-accent hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg" > View Details </button> </div> </div> );
    return ( <div className="bg-surface p-6 rounded-lg shadow-lg mt-8 relative"> <h2 className="text-2xl font-semibold text-text-primary mb-4 flex items-center"> <Calendar className="w-6 h-6 mr-3 text-accent"/> Job Details </h2> {JobDetailsForm} {project.status === ProjectStatus.COMPLETED && isCompletedOverlayVisible && CompletedOverlay} </div> );
};

export default FinalizeJobSection;