import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock, Check, XCircle, Globe, Lock, Edit2, Trash2, Plus } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useInstallers } from '../hooks/useInstallers';
import CalendarFilter from '../components/CalendarFilter';
import Select, { MultiValue } from 'react-select';
import { toast } from 'react-hot-toast';
import * as eventService from '../services/eventService';
import { Event as ApiEvent, Installer, User } from '../types';
import { formatDate } from '../utils/dateUtils';
import { getEndpoint } from '../utils/apiConfig';
import { fromZonedTime } from 'date-fns-tz';
import MentionInput from '../components/MentionInput';
import SmartMessage from '../components/SmartMessage'; // Assuming this exists from Chat feature

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
    projectStatus?: string; // ADDED
    poNumber?: string;      // ADDED
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

// NEW: Helper to fix the "Midnight UTC = Previous Day" bug for Material Orders
const parseEventDate = (dateStr: string, type: string): Date => {
    const date = new Date(dateStr);
    if (type === 'material_order_eta') {
        // Add the timezone offset to force the UTC midnight time back to Local midnight
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    }
    return date;
};

// Strips markup for calendar grid display
const stripMentions = (text: string): string => {
    if (!text) return '';
    return text.replace(/@\[\w+:[\w-]+\|([^\]]+)\]/g, '$1');
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
    const { users, currentUser, systemBranding } = useData(); 
    const { data: installers = [] } = useInstallers();
    
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedInstallerIds, setSelectedInstallerIds] = useState<Set<number>>(new Set());
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [showDeliveries, setShowDeliveries] = useState(true);
    
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<ApiEvent | null>(null); 
    const [newlySelectedDate, setNewlySelectedDate] = useState<Date | null>(null);
    const [dayViewDate, setDayViewDate] = useState<Date | null>(null);

    useEffect(() => {
        if (installers && installers.length > 0) {
            setSelectedInstallerIds(new Set(installers.map(i => i.id)));
        }
        if (users && users.length > 0) {
            setSelectedUserIds(new Set(users.map(u => u.userId)));
        }
    }, [installers, users]);

    const fetchCalendarEvents = useCallback(async () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        
        const installerIds = Array.from(selectedInstallerIds);
        if (installerIds.length > 0) params.append('installers', installerIds.join(','));
        
        const userIds = Array.from(selectedUserIds);
        if (userIds.length > 0) params.append('users', userIds.join(','));
        
        try {
            const response = await fetch(getEndpoint(`/api/calendar/events?${params.toString()}`), { 
                credentials: 'include' 
            });
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

    // --- Grid / Month Logic (Desktop) ---
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const gridStartDate = new Date(startOfMonth);
    gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay()); // Start on Sunday
    const gridEndDate = new Date(endOfMonth);
    gridEndDate.setDate(gridEndDate.getDate() + (6 - gridEndDate.getDay())); // End on Saturday
    
    const monthDays = [];
    let d = new Date(gridStartDate);
    while (d <= gridEndDate) {
        monthDays.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    // --- Agenda / Week Logic (Mobile) ---
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday of current week
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        return day;
    });

    const getEventsForDay = (date: Date) => {
        const checkDate = normalizeDate(date);
        const filteredEvents = events.filter(event => {
            if (!event.start || !event.end) return false;
            
            // Filter Deliveries
            if (!showDeliveries && event.type === 'material_order_eta') return false;

            const eventStart = normalizeDate(parseEventDate(event.start, event.type));
            const eventEnd = normalizeDate(parseEventDate(event.end, event.type));
            return checkDate >= eventStart && checkDate <= eventEnd;
        });

        return filteredEvents.sort((a, b) => {
            const startA = new Date(a.start).getTime();
            const startB = new Date(b.start).getTime();
            if (startA !== startB) return startA - startB;

            const endA = new Date(a.end).getTime();
            const endB = new Date(b.end).getTime();
            const durationA = endA - startA;
            const durationB = endB - startB;
            if (durationA !== durationB) return durationB - durationA;

            return a.id - b.id;
        });
    };
    
    const changeMonth = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + amount);
        setCurrentDate(newDate);
    };

    const changeWeek = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (amount * 7));
        setCurrentDate(newDate);
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
        setDayViewDate(null);
    };

    const handleOverflowClick = (date: Date) => {
        setDayViewDate(date);
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

    const renderEventItem = (event: CalendarEvent, date: Date, viewMode: 'grid' | 'list' = 'grid') => {
        const jobStart = normalizeDate(parseEventDate(event.start, event.type));
        const jobEnd = normalizeDate(parseEventDate(event.end, event.type));
        const currentDay = normalizeDate(date);
        const isStartDate = currentDay.getTime() === jobStart.getTime();
        const isEndDate = currentDay.getTime() === jobEnd.getTime();
        const isStartOfWeek = date.getDay() === 0;
        
        // In List view, we always show the label because items are stacked
        const showLabel = viewMode === 'list' || isStartDate || isStartOfWeek || (dayViewDate !== null);
        const isUserAppointment = event.type === 'user_appointment';
        
        const isMaterialOrder = event.type === 'material_order_eta';
        const isReceived = isMaterialOrder && (event.fullEvent as any)?.status === 'Received';
        const isJobComplete = event.type === 'appointment' && (event.fullEvent as any)?.isJobComplete;

        let labelText = event.type === 'appointment' ? `${event.title} (${event.customerName.split(' ')[0]})` : event.title;
        
        // ADDED: Show PO Number if available
        if (event.type === 'appointment' && event.poNumber) {
            labelText += ` - PO: ${event.poNumber}`;
        }

        labelText = stripMentions(labelText);

        let eventColor = event.backgroundColor || '#6b7280';
        if (isUserAppointment) {
            const fullEvent = event.fullEvent;
            if (fullEvent && fullEvent.attendees && fullEvent.attendees.length === 1) {
                const singleAttendee = fullEvent.attendees[0];
                if ((singleAttendee as any).color) {
                    eventColor = (singleAttendee as any).color;
                } else if (singleAttendee.attendeeType === 'user') {
                    if (currentUser && currentUser.userId === singleAttendee.attendeeId) {
                        eventColor = currentUser.preferences?.calendarColor || '#3B82FF';
                    } else {
                        const user = (users || []).find(u => u.userId === singleAttendee.attendeeId);
                        eventColor = user?.color || '#3B82FF';
                    }
                } else {
                    const installer = (installers || []).find(i => String(i.id) === singleAttendee.attendeeId);
                    eventColor = installer?.color || '#3B82FF';
                }
            } else {
                eventColor = '#3B82FF'; 
            }
        }
        
        const textColor = getContrastingTextColor(eventColor);
        
        let classNames = 'block text-xs p-1 truncate relative overflow-hidden mb-1';
        if (viewMode === 'list') {
             classNames = 'block text-sm p-2 rounded relative overflow-hidden mb-2'; 
        } else {
            if (dayViewDate !== null) {
                classNames += ' rounded';
            } else {
                if (isStartDate && isEndDate) classNames += ' rounded';
                else if (isStartDate) classNames += ' rounded-l';
                else if (isEndDate) classNames += ' rounded-r-md';
            }
        }
        
        if (event.isOnHold) classNames += ' on-hold-event';

        const itemStyle: React.CSSProperties = !event.isOnHold 
            ? { backgroundColor: eventColor, color: textColor } 
            : { color: '#a0a0a0' };

        // Check for Job Completed status from the projectStatus field
        if ((isReceived || isJobComplete || event.projectStatus === 'Completed') && !event.isOnHold) {
            itemStyle.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.2) 5px, rgba(0,0,0,0.2) 10px)';
            labelText = `✓ ${labelText}`;
        }

        if (isUserAppointment) {
            const isAllDay = (event.fullEvent as any)?.isAllDay;
            const timeString = isAllDay ? 'All Day' : new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            return (
                <div
                    onClick={(e) => { e.stopPropagation(); handleUserAppointmentClick(event.fullEvent as ApiEvent); }}
                    key={event.appointmentId}
                    className={`${classNames} cursor-pointer`}
                    style={{ backgroundColor: eventColor, color: textColor }}
                    title={labelText}
                >
                    <span className="font-bold">{timeString}</span>
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
                    onClick={(e) => e.stopPropagation()} 
                >
                    {showLabel ? labelText : '\u00A0'}
                </Link>
            );
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading Calendar...</div>;
    }

    const MAX_EVENTS_PER_CELL = 2;

    return (
        <div className="flex flex-col h-full gap-4 md:gap-6">
            <div className="bg-surface p-4 md:p-6 rounded-lg shadow-md border border-border flex flex-col md:flex-row justify-between md:items-center gap-4">
                
                {/* Mobile Layout: Title on top, then controls row */}
                {/* Desktop Layout: Title Left, Month Nav Left-Center, Filter Right */}
                
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 w-full md:w-auto">
                    {/* Title */}
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-8 h-8 text-primary" />
                        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Calendar</h1>
                    </div>
                    
                    {/* Desktop Divider */}
                    <div className="h-10 w-px bg-border hidden md:block"></div>

                    {/* Month Nav & Filter Container */}
                    {/* On Mobile: This row sits under title. On Desktop: Sits next to title/filter. */}
                    <div className="flex flex-row items-center justify-between gap-4 w-full md:w-auto">
                        {/* Month Nav */}
                        <div className="flex items-center bg-background rounded-lg border border-border p-1 shadow-sm flex-shrink-0">
                            <button onClick={() => changeMonth(-1)} className="p-2 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"><ChevronLeft size={20}/></button>
                            <span className="font-bold text-sm md:text-lg px-2 md:px-4 min-w-[120px] md:min-w-[180px] text-center text-text-primary">
                                {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => changeMonth(1)} className="p-2 rounded hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"><ChevronRight size={20}/></button>
                        </div>

                        {/* Filter - Hidden on Desktop here because it moves to the right. Visible on Mobile. */}
                        <div className="block md:hidden w-full max-w-[200px]">
                            <CalendarFilter 
                                installers={installers}
                                users={users}
                                selectedInstallerIds={selectedInstallerIds}
                                selectedUserIds={selectedUserIds}
                                showDeliveries={showDeliveries}
                                onInstallerChange={setSelectedInstallerIds}
                                onUserChange={setSelectedUserIds}
                                onShowDeliveriesChange={setShowDeliveries}
                            />
                        </div>
                    </div>
                </div>

                {/* Filter - Desktop Position */}
                <div className="hidden md:block w-full md:w-auto">
                    <CalendarFilter 
                        installers={installers}
                        users={users}
                        selectedInstallerIds={selectedInstallerIds}
                        selectedUserIds={selectedUserIds}
                        showDeliveries={showDeliveries}
                        onInstallerChange={setSelectedInstallerIds}
                        onUserChange={setSelectedUserIds}
                        onShowDeliveriesChange={setShowDeliveries}
                    />
                </div>
            </div>

            {/* Mobile View: Agenda List (One week at a time) */}
            <div className="md:hidden flex-1 flex flex-col gap-4">
                {/* Week Navigation */}
                <div className="flex justify-between items-center bg-surface p-3 rounded-lg border border-border shadow-sm">
                    <button onClick={() => changeWeek(-1)} className="flex items-center text-sm font-medium text-text-secondary hover:text-primary">
                        <ChevronLeft size={16} className="mr-1"/> Prev Week
                    </button>
                    <span className="text-sm font-bold text-text-primary">
                        Week of {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <button onClick={() => changeWeek(1)} className="flex items-center text-sm font-medium text-text-secondary hover:text-primary">
                        Next Week <ChevronRight size={16} className="ml-1"/>
                    </button>
                </div>

                {/* Daily Vertical Stack */}
                <div className="space-y-4">
                    {weekDays.map((d, i) => {
                         const eventsForDay = getEventsForDay(d);
                         const isTodayDate = isToday(d);
                         
                         return (
                            <div key={i} className={`bg-surface border ${isTodayDate ? 'border-primary' : 'border-border'} rounded-lg shadow-sm overflow-hidden`}>
                                <div className="flex justify-between items-center p-3 bg-background border-b border-border">
                                    <div className="flex items-center gap-2">
                                        <div className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-primary text-on-primary' : 'text-text-primary'}`}>
                                            {d.getDate()}
                                        </div>
                                        <span className="font-semibold text-text-primary">
                                            {d.toLocaleDateString(undefined, { weekday: 'long' })}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => handleDayClick(d)}
                                        className="p-1.5 bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-md transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                <div className="p-3 min-h-[60px]">
                                    {eventsForDay.length > 0 ? (
                                        eventsForDay.map(event => renderEventItem(event, d, 'list'))
                                    ) : (
                                        <p className="text-sm text-text-tertiary italic">No events scheduled</p>
                                    )}
                                </div>
                            </div>
                         );
                    })}
                </div>
            </div>

            {/* Desktop View: Traditional Grid */}
            <div className="hidden md:flex bg-surface p-6 rounded-lg shadow-md border border-border flex-1 flex-col min-h-0 relative">
                <div className="grid grid-cols-7 text-center font-semibold text-text-primary border-b border-border pb-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                </div>

                <div className="grid grid-cols-7 grid-rows-6 flex-1">
                    {monthDays.map((d, i) => {
                        const eventsForDay = getEventsForDay(d);
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                        
                        const visibleEvents = eventsForDay.slice(0, MAX_EVENTS_PER_CELL);
                        const hiddenCount = eventsForDay.length - MAX_EVENTS_PER_CELL;

                        return (
                            <div 
                                key={i} 
                                onClick={() => handleDayClick(d)} 
                                className={`border border-border flex flex-col cursor-pointer transition-colors ${isCurrentMonth ? 'hover:bg-background' : 'bg-background text-text-secondary'}`}
                            >
                                <span className={`font-semibold mb-1 self-start p-1 ${isToday(d) ? 'bg-accent text-on-accent rounded-full w-7 h-7 flex items-center justify-center' : 'w-7 h-7 flex items-center justify-center text-text-primary'}`}>
                                    {d.getDate()}
                                </span>
                                <div className="flex-1 overflow-hidden px-1">
                                    {visibleEvents.map(event => renderEventItem(event, d))}
                                    
                                    {hiddenCount > 0 && (
                                        <div 
                                            onClick={(e) => { e.stopPropagation(); handleOverflowClick(d); }}
                                            className="text-xs text-text-secondary font-medium hover:text-primary cursor-pointer mt-1 bg-surface/50 rounded p-1 text-center"
                                        >
                                            + {hiddenCount} More
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {dayViewDate && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-surface p-6 rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                            <h2 className="text-xl font-bold text-text-primary">
                                {dayViewDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </h2>
                            <button onClick={() => setDayViewDate(null)} className="text-text-secondary hover:text-text-primary">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {getEventsForDay(dayViewDate).map(event => renderEventItem(event, dayViewDate))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-border flex justify-end">
                            <button 
                                onClick={() => { setDayViewDate(null); handleDayClick(dayViewDate); }}
                                className="text-primary hover:text-primary-hover text-sm font-semibold"
                            >
                                + Add New Event
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
    const { users, currentUser, systemBranding } = useData();
    const { data: installers = [] } = useInstallers();
    const systemTimezone = systemBranding?.systemTimezone;

    // Determine Mode: CREATE vs VIEW vs EDIT
    // New Event -> Edit Mode
    // Existing Event -> View Mode (default) -> Edit Mode (if owner)
    
    // We check ownership using the createdByUserId
    const isOwner = !event || (currentUser && event.createdByUserId === currentUser.userId);
    
    // Default to View Mode if event exists, else Edit Mode
    const [isEditMode, setIsEditMode] = useState(!event); 

    // Form State
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [isAllDay, setIsAllDay] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [attendees, setAttendees] = useState<MultiValue<AttendeeOption>>([]);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const attendeeOptions: AttendeeOption[] = React.useMemo(() => [
        ...(users || []).map(u => ({ label: u.email, value: `user-${u.userId}`, type: 'user' as const, color: u.color })),
        ...(installers || []).map(i => ({ label: i.installerName, value: `installer-${String(i.id)}`, type: 'installer' as const, color: i.color }))
    ], [users, installers]);

    // Load Data
    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setNotes(event.notes || '');
            
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            setStartDate(formatDateForInput(start));
            setEndDate(formatDateForInput(end));
            setStartTime(start.toTimeString().substring(0, 5));
            setEndTime(end.toTimeString().substring(0, 5));
            setIsAllDay(event.isAllDay || false);
            setIsPublic(event.isPublic || false); // Backend must return this now!
            
            if (event.attendees) {
                const selectedAttendees = event.attendees.map(att => {
                    if (att.attendeeType === 'user') {
                        const user = (users || []).find(u => u.userId === att.attendeeId); 
                        let color = user?.color || null;
                        if (!color && currentUser && currentUser.userId === att.attendeeId) color = currentUser.preferences?.calendarColor;
                        return user ? { label: user.email, value: `user-${user.userId}`, type: 'user' as const, color: color } : null;
                    } else {
                        const installer = (installers || []).find((i: Installer) => String(i.id) === att.attendeeId);
                        return installer ? { label: installer.installerName, value: `installer-${String(installer.id)}`, type: 'installer' as const, color: installer.color } : null;
                    }
                }).filter((opt): opt is AttendeeOption => opt !== null);
                setAttendees(selectedAttendees);
            }
        } else if (selectedDate) {
            // Defaults for new event
            setTitle('');
            setNotes('');
            const dateStr = formatDateForInput(selectedDate);
            setStartDate(dateStr);
            setEndDate(dateStr);
            setStartTime('09:00');
            setEndTime('10:00');
            setIsAllDay(false);
            setIsPublic(false);

            if (currentUser) {
                const selfAttendee: AttendeeOption = {
                    label: currentUser.email, value: `user-${currentUser.userId}`, type: 'user' as const, color: currentUser.preferences?.calendarColor
                };
                setAttendees([selfAttendee]);
            } else { setAttendees([]); }
        }
    }, [event, selectedDate, users, installers, currentUser]);

    // --- ACTIONS ---

    const handleSave = async () => {
        if (!title) { toast.error("Title is required."); return; }
        setIsSaving(true);
        try {
            const timeZone = systemTimezone || 'America/Los_Angeles';
            let startDateTime: Date, endDateTime: Date;

            if (isAllDay) {
                const s = `${startDate}T00:00:00`;
                const e = `${endDate}T23:59:59`;
                startDateTime = fromZonedTime(s, timeZone);
                endDateTime = fromZonedTime(e, timeZone);
            } else {
                const s = `${startDate}T${startTime}:00`;
                const e = `${endDate}T${endTime}:00`;
                startDateTime = fromZonedTime(s, timeZone);
                endDateTime = fromZonedTime(e, timeZone);
            }

            const eventData = {
                title,
                notes,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                isAllDay,
                isPublic,
                jobId: null, 
                attendees: attendees.map(opt => {
                    const firstHyphenIndex = opt.value.indexOf('-');
                    const attendeeId = opt.value.substring(firstHyphenIndex + 1);
                    return { attendeeId: attendeeId, attendeeType: opt.type };
                })
            };
            
            if (event) {
                await eventService.updateEvent(event.id, eventData);
                toast.success("Updated!");
            } else {
                await eventService.createEvent(eventData);
                toast.success("Created!");
            }
            onSaveSuccess();
            onClose();
        } catch (error) {
            toast.error("Failed to save.");
            console.error(error);
        } finally { setIsSaving(false); }
    };
    
    const handleDelete = async () => {
        if (!event || !window.confirm("Delete this appointment?")) return;
        setIsDeleting(true);
        try {
            await eventService.deleteEvent(event.id);
            toast.success("Deleted.");
            onSaveSuccess();
            onClose();
        } catch (error) { toast.error("Failed to delete."); } 
        finally { setIsDeleting(false); }
    };

    const handleRespond = async (status: 'accepted' | 'declined') => {
        if (!event) return;
        try {
            // Assuming eventService has this new method
            const res = await fetch(getEndpoint(`/api/events/${event.id}/respond`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
                credentials: 'include'
            });
            if (!res.ok) throw new Error("Failed");
            toast.success(`Invitation ${status}`);
            onSaveSuccess(); // Refresh to show new status
            onClose();
        } catch (e) { toast.error("Could not update status"); }
    };

    // --- RENDER ---

    if (!isOpen) return null;

    // My Status Logic
    const myAttendeeRecord = event?.attendees?.find(a => a.attendeeType === 'user' && a.attendeeId === currentUser?.userId);
    const myStatus = (myAttendeeRecord as any)?.status || 'pending';
    const isPendingInvite = !!event && !isOwner && myAttendeeRecord && myStatus === 'pending';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-lg relative">
                
                {/* Header Actions */}
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-text-primary">
                        {!event ? 'New Appointment' : isEditMode ? 'Edit Appointment' : 'Appointment Details'}
                    </h2>
                    <div className="flex items-center gap-2">
                        {event && !isEditMode && isOwner && (
                            <button onClick={() => setIsEditMode(true)} className="p-2 text-primary hover:bg-background rounded-full" title="Edit">
                                <Edit2 size={18} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-background">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* --- VIEW MODE --- */}
                {!isEditMode && event ? (
                    <div className="space-y-6">
                        {/* Title & Time */}
                        <div>
                            <h3 className="text-xl font-semibold text-text-primary mb-1">
                                <span dangerouslySetInnerHTML={{__html: stripMentions(event.title)}} />
                            </h3>
                            <div className="flex items-center text-text-secondary text-sm">
                                <Clock size={16} className="mr-2" />
                                {new Date(event.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} 
                                {' - '}
                                {new Date(event.endTime).toLocaleString([], { timeStyle: 'short' })}
                            </div>
                            {event.isPublic && (
                                <div className="flex items-center text-xs text-primary mt-1">
                                    <Globe size={12} className="mr-1" /> Public Event
                                </div>
                            )}
                        </div>

                        {/* Smart Notes */}
                        <div className="bg-background p-4 rounded-md border border-border max-h-60 overflow-y-auto">
                            <SmartMessage content={event.notes || 'No notes provided.'} />
                        </div>

                        {/* Attendees List */}
                        <div>
                            <h4 className="text-sm font-semibold text-text-secondary mb-2">Attendees</h4>
                            <div className="flex flex-wrap gap-2">
                                {event.attendees?.map((att: any, idx: number) => {
                                    const isUser = att.attendeeType === 'user';
                                    const name = isUser 
                                        ? users.find(u => u.userId === att.attendeeId)?.email 
                                        : installers.find(i => String(i.id) === att.attendeeId)?.installerName;
                                    
                                    // Status Icon
                                    let Icon = Clock;
                                    let colorClass = 'text-yellow-500';
                                    if (att.status === 'accepted') { Icon = Check; colorClass = 'text-green-500'; }
                                    if (att.status === 'declined') { Icon = XCircle; colorClass = 'text-red-500'; }

                                    return (
                                        <div key={idx} className="flex items-center bg-background border border-border px-2 py-1 rounded-full text-xs">
                                            <Icon size={12} className={`mr-1 ${colorClass}`} />
                                            <span className="text-text-primary">{name || 'Unknown'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Action Bar (For Invitees) */}
                        {isPendingInvite && (
                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <span className="text-sm text-text-secondary self-center mr-auto">You are invited:</span>
                                <button onClick={() => handleRespond('declined')} className="px-3 py-1.5 text-sm border border-red-500 text-red-500 rounded hover:bg-red-50">Decline</button>
                                <button onClick={() => handleRespond('accepted')} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">Accept</button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* --- EDIT MODE --- */
                    <div className="space-y-4">
                        
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Title</label>
                            <MentionInput value={title} onChange={setTitle} placeholder="Event Title..." singleLine />
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Start</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary mb-2" />
                                {!isAllDay && <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">End</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary mb-2" />
                                {!isAllDay && <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 bg-background border border-border rounded text-text-primary" />}
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="flex justify-between">
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="isAllDay" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary" />
                                <label htmlFor="isAllDay" className="text-sm font-medium text-text-primary cursor-pointer">All Day</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="isPublic" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary" />
                                <label htmlFor="isPublic" className="text-sm font-medium text-text-primary cursor-pointer flex items-center">
                                    {isPublic ? <Globe size={14} className="mr-1"/> : <Lock size={14} className="mr-1"/>}
                                    {isPublic ? 'Public Event' : 'Private'}
                                </label>
                            </div>
                        </div>

                        {/* Attendees */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Attendees</label>
                            <Select isMulti options={attendeeOptions} value={attendees} onChange={setAttendees} className="react-select-container mt-1" classNamePrefix="react-select" styles={{ control: (base) => ({ ...base, backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }), input: (base) => ({ ...base, color: 'var(--color-text-primary)' }), multiValue: (base) => ({ ...base, backgroundColor: 'var(--color-surface)' }), multiValueLabel: (base) => ({ ...base, color: 'var(--color-text-primary)' }), menu: (base) => ({ ...base, backgroundColor: 'var(--color-background)' }), option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? 'var(--color-primary)' : isFocused ? 'var(--color-surface)' : undefined, color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-primary)' }) }} />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                            <MentionInput value={notes} onChange={setNotes} placeholder="Add notes..." minHeight={80} />
                        </div>

                        {/* Buttons */}
                        <div className="mt-6 flex justify-end gap-4">
                            {event && (
                                <button type="button" onClick={handleDelete} disabled={isDeleting} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-white font-semibold mr-auto">
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <button type="button" onClick={() => event ? setIsEditMode(false) : onClose()} className="py-2 px-4 bg-secondary hover:bg-secondary-hover rounded text-on-secondary font-semibold">Cancel</button>
                            <button type="button" onClick={handleSave} disabled={isSaving} className="py-2 px-4 bg-primary hover:bg-primary-hover rounded text-on-primary font-semibold">{isSaving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarView;