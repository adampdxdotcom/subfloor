import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import CalendarFilter from '../components/CalendarFilter';
import Select, { MultiValue } from 'react-select';
import { toast } from 'react-hot-toast';
import * as eventService from '../services/eventService';
import { Event as ApiEvent, Installer, User } from '../types';

interface CalendarEvent {
    id: number;
    appointmentId: number;
    title: string;
    type: 'appointment' | 'material_order_eta' | 'user_appointment';
    start: string;
    end: string;
    fullEvent: ApiEvent | null;
    customerName: string;
    backgroundColor: string | null;
    isOnHold: boolean;
}

interface AttendeeOption {
    label: string;
    value: string;
    type: 'user' | 'installer';
    color?: string | null;
}

const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDate = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

const getContrastingTextColor = (hexColor: string | null): string => {
    if (!hexColor) return '#FFFFFF';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

const CalendarView: React.FC = () => {
    const { installers, users, currentUser } = useData();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedInstallerIds, setSelectedInstallerIds] = new useState<Set<number>>(new Set());
    // --- ADDED: State for the new user filter ---
    const [selectedUserIds, setSelectedUserIds] = new useState<Set<string>>(new Set());
    
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<ApiEvent | null>(null); 
    const [newlySelectedDate, setNewlySelectedDate] = useState<Date | null>(null);

    useEffect(() => {
        if (installers && installers.length > 0) {
            setSelectedInstallerIds(new Set(installers.map(i => i.id)));
        }
        // --- ADDED: Initialize user filter to all selected ---
        if (users && users.length > 0) {
            setSelectedUserIds(new Set(users.map(u => u.userId)));
        }
    }, [installers, users]);

    // Define fetcher as a stable callback
    const fetchCalendarEvents = useCallback(async () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        
        const installerIds = Array.from(selectedInstallerIds);
        if (installerIds.length > 0) params.append('installers', installerIds.join(','));
        
        const userIds = Array.from(selectedUserIds);
        if (userIds.length > 0) params.append('users', userIds.join(','));
        
        try {
            const response = await fetch(`/api/calendar/events?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch calendar events');
            const data: CalendarEvent[] = await response.json();
            setEvents(data);
        } catch (error) {
            console.error("Error fetching calendar events:", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedInstallerIds, selectedUserIds]);

    useEffect(() => {
        fetchCalendarEvents();
    }, [currentDate, fetchCalendarEvents]);

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    const days = [];
    let day = new Date(startDate);
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    const getEventsForDay = (date: Date) => {
        const checkDate = normalizeDate(date);
        return events.filter(event => {
            if (!event.start || !event.end) return false;
            const eventStart = normalizeDate(new Date(event.start));
            const eventEnd = normalizeDate(new Date(event.end));
            return checkDate >= eventStart && checkDate <= eventEnd;
        });
    };
    
    const changeMonth = (amount: number) => {
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + amount)));
    };

    const handleDayClick = (date: Date) => {
        setEditingEvent(null);
        setNewlySelectedDate(date);
        setIsAppointmentModalOpen(true);
    };

    const handleUserAppointmentClick = (eventData: ApiEvent) => {
        setEditingEvent(eventData);
        setNewlySelectedDate(null);
        setIsAppointmentModalOpen(true);
    };

    const refetchEvents = () => {
        fetchCalendarEvents();
    };

    const handleCloseModal = () => {
        setIsAppointmentModalOpen(false);
        setEditingEvent(null);
        setNewlySelectedDate(null);
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading Calendar...</div>;
    }

    return (
        <div className="bg-surface p-6 rounded-lg shadow-lg h-full flex flex-col">
            <div className="flex justify-between items-center gap-4 mb-4">
                <div className="flex items-center">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-background text-text-primary"><ChevronLeft/></button>
                    <h1 className="text-2xl font-bold text-text-primary mx-4">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h1>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-background text-text-primary"><ChevronRight/></button>
                </div>
                <div className="ml-auto">
                    <CalendarFilter 
                        installers={installers}
                        users={users}
                        selectedInstallerIds={selectedInstallerIds}
                        selectedUserIds={selectedUserIds}
                        onInstallerChange={setSelectedInstallerIds}
                        onUserChange={setSelectedUserIds}
                    />
                </div>
            </div>

            <div className="grid grid-cols-7 text-center font-semibold text-text-primary border-b border-border pb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 grid-rows-6 flex-1">
                {days.map((d, i) => {
                    const eventsForDay = getEventsForDay(d);
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();

                    return (
                        <div 
                            key={i} 
                            onClick={() => handleDayClick(d)} 
                            className={`border border-border flex flex-col cursor-pointer transition-colors ${isCurrentMonth ? 'hover:bg-background' : 'bg-background text-text-secondary'}`}
                        >
                            <span className={`font-semibold mb-1 self-start p-1 ${isToday(d) ? 'bg-accent text-on-accent rounded-full w-7 h-7 flex items-center justify-center' : 'w-7 h-7 flex items-center justify-center text-text-primary'}`}>
                                {d.getDate()}
                            </span>
                            <div className="flex-1 overflow-y-auto space-y-1 p-1">
                                {eventsForDay.map(event => {
                                    const jobStart = normalizeDate(new Date(event.start));
                                    const jobEnd = normalizeDate(new Date(event.end));
                                    const currentDay = normalizeDate(d);
                                    const isStartDate = currentDay.getTime() === jobStart.getTime();
                                    const isEndDate = currentDay.getTime() === jobEnd.getTime();
                                    const isStartOfWeek = d.getDay() === 0;
                                    const showLabel = isStartDate || isStartOfWeek;
                                    const isUserAppointment = event.type === 'user_appointment';
                                    
                                    const isMaterialOrder = event.type === 'material_order_eta';
                                    const isReceived = isMaterialOrder && (event.fullEvent as any)?.status === 'Received';
                                    
                                    let labelText = event.type === 'appointment' ? `${event.title} (${event.customerName.split(' ')[0]})` : event.title;
                                    
                                    let eventColor = event.backgroundColor || '#6b7280';
                                    if (isUserAppointment) {
                                        const fullEvent = event.fullEvent;
                                        if (fullEvent && fullEvent.attendees && fullEvent.attendees.length === 1) {
                                            const singleAttendee = fullEvent.attendees[0];
                                            
                                            // Priority 1: Use color directly from backend if available (most accurate)
                                            if ((singleAttendee as any).color) {
                                                eventColor = (singleAttendee as any).color;
                                            } 
                                            // Priority 2: If User, check Current User (reactive) or Context List
                                            else if (singleAttendee.attendeeType === 'user') {
                                                if (currentUser && currentUser.userId === singleAttendee.attendeeId) {
                                                    // FIX: Access color from preferences, not the root user object
                                                    eventColor = currentUser.preferences?.calendarColor || '#3B82F6';
                                                } else {
                                                    const user = (users || []).find(u => u.userId === singleAttendee.attendeeId);
                                                    // Note: The User object now contains a 'color' property fetched from the DB for other users.
                                                    eventColor = user?.color || '#3B82F6';
                                                }
                                            } else {
                                                const installer = (installers || []).find(i => String(i.id) === singleAttendee.attendeeId);
                                                eventColor = installer?.color || '#3B82F6';
                                            }
                                        } else {
                                            eventColor = '#3B82F6'; 
                                        }
                                    }
                                    
                                    const textColor = getContrastingTextColor(eventColor);
                                    let classNames = 'block text-xs p-1 truncate relative overflow-hidden';
                                    if (isStartDate && isEndDate) classNames += ' rounded';
                                    else if (isStartDate) classNames += ' rounded-l';
                                    else if (isEndDate) classNames += ' rounded-r-md';
                                    if (event.isOnHold) classNames += ' on-hold-event';

                                    // Style logic for standard events (Jobs/Orders)
                                    const itemStyle: React.CSSProperties = !event.isOnHold 
                                        ? { backgroundColor: eventColor, color: textColor } 
                                        : { color: '#a0a0a0' };

                                    if (isReceived && !event.isOnHold) {
                                        // Apply hash pattern for received orders
                                        itemStyle.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.2) 5px, rgba(0,0,0,0.2) 10px)';
                                        labelText = `✓ ${labelText}`; // Add visual indicator to text as well
                                    }

                                    if (isUserAppointment) {
                                        return (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); handleUserAppointmentClick(event.fullEvent as ApiEvent); }}
                                                key={event.appointmentId}
                                                className={`${classNames} cursor-pointer`}
                                                style={{ backgroundColor: eventColor, color: textColor }}
                                                title={labelText}
                                            >
                                                <span className="font-bold">{new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                                <span className="ml-1">{showLabel ? labelText : ''}</span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <Link 
                                                to={`/projects/${event.id}`} 
                                                key={event.appointmentId} 
                                                className={classNames}
                                                style={itemStyle}
                                                title={labelText}
                                            >
                                                {showLabel ? labelText : '\u00A0'}
                                            </Link>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            {isAppointmentModalOpen && (
                <AddEditEventModal
                    isOpen={isAppointmentModalOpen}
                    onClose={handleCloseModal}
                    event={editingEvent}
                    selectedDate={newlySelectedDate}
                    onSaveSuccess={refetchEvents}
                />
            )}
        </div>
    );
};

interface AddEditEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: ApiEvent | null;
    selectedDate: Date | null;
    onSaveSuccess: () => void;
}

const AddEditEventModal: React.FC<AddEditEventModalProps> = ({ isOpen, onClose, event, selectedDate, onSaveSuccess }) => {
    const { users, installers, currentUser } = useData();
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [attendees, setAttendees] = useState<MultiValue<AttendeeOption>>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const attendeeOptions: AttendeeOption[] = React.useMemo(() => [
        // FIX: Now that `u.color` is available on the User object (fetched from DB), we use it here.
        ...(users || []).map(u => ({ label: u.email, value: `user-${u.userId}`, type: 'user' as const, color: u.color })),
        ...(installers || []).map(i => ({ label: i.installerName, value: `installer-${String(i.id)}`, type: 'installer' as const, color: i.color }))
    ], [users, installers]);

    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setNotes(event.notes || '');
            const start = new Date(event.startTime);
            setStartDate(formatDateForInput(start));
            setStartTime(start.toTimeString().substring(0, 5));
            
            if (event.attendees) {
                const selectedAttendees = event.attendees.map(att => {
                    if (att.attendeeType === 'user') {
                        const user = (users || []).find(u => u.userId === att.attendeeId); 
                        
                        // When editing, we prefer the user's fetched color (`user.color`) if available.
                        let color = user?.color || null;
                        
                        // If it's the current user, ensure we use the live context color if the fetched user list color is missing.
                        if (!color && currentUser && currentUser.userId === att.attendeeId) {
                            color = currentUser.preferences?.calendarColor;
                        }

                        return user ? { label: user.email, value: `user-${user.userId}`, type: 'user' as const, color: color } : null;
                    } else {
                        const installer = (installers || []).find((i: Installer) => String(i.id) === att.attendeeId);
                        return installer ? { label: installer.installerName, value: `installer-${String(installer.id)}`, type: 'installer' as const, color: installer.color } : null;
                    }
                }).filter((opt): opt is AttendeeOption => opt !== null);
                setAttendees(selectedAttendees);
            }
        } else if (selectedDate) {
            setTitle('');
            setNotes('');
            setStartDate(formatDateForInput(selectedDate));
            setStartTime('09:00');
            if (currentUser) {
                const selfAttendee: AttendeeOption = {
                    // FIX: Use preferences color for self-selection in modal
                    label: currentUser.email, value: `user-${currentUser.userId}`, type: 'user' as const, color: currentUser.preferences?.calendarColor
                };
                setAttendees([selfAttendee]);
            } else { setAttendees([]); }
        }
    }, [event, selectedDate, users, installers, currentUser]);

    const handleSave = async () => {
        if (!title) {
            toast.error("Title is required.");
            return;
        }
        setIsSaving(true);
        try {
            const startDateTime = new Date(`${startDate}T${startTime}`);
            // --- THIS IS THE CRITICAL FIX ---
            const eventData = {
                title,
                notes,
                startTime: startDateTime.toISOString(),
                endTime: startDateTime.toISOString(),
                isAllDay: false,
                jobId: null, // Add jobId for billable time later
                attendees: attendees.map(opt => {
                    // Robustly parse the ID from the value string
                    const firstHyphenIndex = opt.value.indexOf('-');
                    const attendeeId = opt.value.substring(firstHyphenIndex + 1);
                    return {
                        attendeeId: attendeeId, 
                        attendeeType: opt.type
                    };
                })
            };
            
            if (event) {
                await eventService.updateEvent(event.id, eventData);
                toast.success("Appointment updated successfully!");
            } else {
                await eventService.createEvent(eventData);
                toast.success("Appointment created successfully!");
            }
            onSaveSuccess();
            onClose();
        } catch (error) {
            toast.error("Failed to save appointment.");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        if (!event || !window.confirm("Are you sure you want to delete this appointment?")) {
            return;
        }
        setIsDeleting(true);
        try {
            await eventService.deleteEvent(event.id);
            toast.success("Appointment deleted.");
            onSaveSuccess();
            onClose();
        } catch (error) {
            toast.error("Failed to delete appointment.");
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-6 text-text-primary">
                    {event ? 'Edit Appointment' : `Add Appointment for ${selectedDate?.toLocaleDateString()}`}
                </h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="appointmentTitle" className="block text-sm font-medium text-text-secondary">Title</label>
                        <input type="text" id="appointmentTitle" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="appointmentDate" className="block text-sm font-medium text-text-secondary">Date</label>
                            <input type="date" id="appointmentDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />
                        </div>
                        <div>
                            <label htmlFor="appointmentTime" className="block text-sm font-medium text-text-secondary">Time</label>
                            <input type="time" id="appointmentTime" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="appointmentAttendees" className="block text-sm font-medium text-text-secondary">Attendees</label>
                        <Select 
                            isMulti 
                            options={attendeeOptions} 
                            value={attendees} 
                            onChange={setAttendees} 
                            className="react-select-container mt-1" 
                            classNamePrefix="react-select" 
                            formatOptionLabel={(option) => (
                                <div className="flex items-center">
                                    <div 
                                        className="w-4 h-4 rounded-full mr-3 flex-shrink-0" 
                                        style={{ backgroundColor: option.color || '#6B7280' }}
                                    />
                                    <span>{option.label}</span>
                                </div>
                            )}
                            styles={{
                            control: (base) => ({ ...base, backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }),
                            input: (base) => ({ ...base, color: 'var(--color-text-primary)' }),
                            multiValue: (base) => ({ ...base, backgroundColor: 'var(--color-surface)' }),
                            multiValueLabel: (base) => ({ ...base, color: 'var(--color-text-primary)' }),
                            menu: (base) => ({ ...base, backgroundColor: 'var(--color-background)' }),
                            option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? 'var(--color-primary)' : isFocused ? 'var(--color-surface)' : undefined, color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-primary)' }),
                        }} />
                    </div>
                    <div>
                        <label htmlFor="appointmentNotes" className="block text-sm font-medium text-text-secondary">Notes</label>
                        <textarea id="appointmentNotes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 bg-background border border-border rounded text-text-primary"></textarea>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    {event && (
                        <button type="button" onClick={handleDelete} disabled={isDeleting || isSaving} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold disabled:opacity-50" style={{ marginRight: 'auto' }}>{isDeleting ? 'Deleting...' : 'Delete'}</button>
                    )}
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-semibold">Cancel</button>
                    <button type="button" onClick={handleSave} disabled={isSaving || isDeleting} className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary font-semibold disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;