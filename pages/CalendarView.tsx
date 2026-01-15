import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock, Check, XCircle, Globe, Lock, Edit2, Trash2, Plus, MapPin, ArrowRight, FileText, Package } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useInstallers } from '../hooks/useInstallers';
import CalendarFilter from '../components/CalendarFilter';
import Select, { MultiValue } from 'react-select';
import { toast } from 'react-hot-toast';
import * as eventService from '../services/eventService';
import { Event as ApiEvent, Installer, User } from '../types';
import { formatDate } from '../utils/dateUtils';
import { getEndpoint, getImageUrl } from '../utils/apiConfig';
import { fromZonedTime } from 'date-fns-tz';
import MentionInput from '../components/MentionInput';
import SmartMessage from '../components/SmartMessage';

interface CalendarEvent {
    id: number;
    appointmentId: number;
    title: string;
    type: 'appointment' | 'material_order_eta' | 'user_appointment';
    start: string;
    end: string;
    fullEvent: any;
    customerName: string;
    backgroundColor: string | null;
    isOnHold: boolean;
    projectStatus?: string; 
    poNumber?: string;      
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

const parseEventDate = (dateStr: string, type: string): Date => {
    const date = new Date(dateStr);
    if (type === 'material_order_eta') {
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    }
    return date;
};

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

const useEventColor = (event: CalendarEvent, users: User[], installers: Installer[], currentUser: any) => {
    if (event.type !== 'user_appointment') return event.backgroundColor || '#6b7280';

    const fullEvent = event.fullEvent;
    if (fullEvent && fullEvent.attendees && fullEvent.attendees.length === 1) {
        const singleAttendee = fullEvent.attendees[0];
        if ((singleAttendee as any).color) {
            return (singleAttendee as any).color;
        } else if (singleAttendee.attendeeType === 'user') {
            if (currentUser && currentUser.userId === singleAttendee.attendeeId) {
                return currentUser.preferences?.calendarColor || '#3B82FF';
            } else {
                const user = (users || []).find(u => u.userId === singleAttendee.attendeeId);
                return user?.color || '#3B82FF';
            }
        } else {
            const installer = (installers || []).find(i => String(i.id) === singleAttendee.attendeeId);
            return installer?.color || '#3B82FF';
        }
    }
    return '#3B82FF'; 
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
    const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);

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

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const gridStartDate = new Date(startOfMonth);
    gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());
    const gridEndDate = new Date(endOfMonth);
    gridEndDate.setDate(gridEndDate.getDate() + (6 - gridEndDate.getDay()));
    
    const monthDays = [];
    let d = new Date(gridStartDate);
    while (d <= gridEndDate) {
        monthDays.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        return day;
    });

    const getEventsForDay = (date: Date) => {
        const checkDate = normalizeDate(date);
        const filteredEvents = events.filter(event => {
            if (!event.start || !event.end) return false;
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
        setPreviewEvent(null);
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
        
        const showLabel = viewMode === 'list' || isStartDate || isStartOfWeek || (dayViewDate !== null);
        const isUserAppointment = event.type === 'user_appointment';
        
        const isMaterialOrder = event.type === 'material_order_eta';
        const isReceived = isMaterialOrder && (event.fullEvent as any)?.status === 'Received';
        const isJobComplete = event.type === 'appointment' && (event.fullEvent as any)?.isJobComplete;

        let labelText = event.type === 'appointment' ? `${event.title} (${event.customerName.split(' ')[0]})` : event.title;
        
        if (event.type === 'appointment' && event.poNumber) {
            labelText += ` - PO: ${event.poNumber}`;
        }

        labelText = stripMentions(labelText);

        const eventColor = useEventColor(event, users || [], installers || [], currentUser);
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
                <div 
                    key={event.appointmentId} 
                    className={`${classNames} cursor-pointer hover:brightness-110`}
                    style={itemStyle}
                    title={labelText}
                    onClick={(e) => { e.stopPropagation(); setPreviewEvent(event); }} 
                >
                    {showLabel ? labelText : '\u00A0'}
                </div>
            );
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading Calendar...</div>;
    }

    const MAX_EVENTS_PER_CELL = 2;

    return (
        <div className="flex flex-col h-full gap-4 md:gap-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 px-1">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">Calendar</h1>
                    </div>
                    
                    <div className="flex flex-row items-center justify-between gap-4 w-full md:w-auto">
                        <div className="flex items-center bg-surface-container-high rounded-full border border-outline/10 p-1 shadow-sm flex-shrink-0">
                            <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary hover:text-text-primary transition-colors"><ChevronLeft size={20}/></button>
                            <span className="font-bold text-sm md:text-lg px-2 md:px-4 min-w-[120px] md:min-w-[180px] text-center text-text-primary">
                                {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-surface-container-highest text-text-secondary hover:text-text-primary transition-colors"><ChevronRight size={20}/></button>
                        </div>

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

            <div className="md:hidden flex-1 flex flex-col gap-4">
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
                                    <button onClick={() => handleDayClick(d)} className="p-1.5 bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-md transition-colors">
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

            <div className="hidden md:flex bg-surface-container-high p-6 rounded-xl shadow-sm border border-outline/10 flex-1 flex-col min-h-0 relative">
                <div className="grid grid-cols-7 text-center font-semibold text-text-primary border-b border-outline/10 pb-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                </div>

                <div className="grid grid-cols-7 grid-rows-6 flex-1">
                    {monthDays.map((d, i) => {
                        const eventsForDay = getEventsForDay(d);
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                        const visibleEvents = eventsForDay.slice(0, MAX_EVENTS_PER_CELL);
                        const hiddenCount = eventsForDay.length - MAX_EVENTS_PER_CELL;

                        return (
                            <div key={i} onClick={() => handleDayClick(d)} className={`border border-outline/10 flex flex-col cursor-pointer transition-colors ${isCurrentMonth ? 'hover:bg-surface-container-highest bg-surface-container-low' : 'bg-surface-container-lowest text-text-secondary opacity-50'}`}>
                                <span className={`font-semibold mb-1 self-start p-1 ml-1 mt-1 ${isToday(d) ? 'bg-primary text-on-primary rounded-full w-7 h-7 flex items-center justify-center shadow-md' : 'w-7 h-7 flex items-center justify-center text-text-primary'}`}>
                                    {d.getDate()}
                                </span>
                                <div className="flex-1 overflow-hidden px-1">
                                    {visibleEvents.map(event => renderEventItem(event, d))}
                                    {hiddenCount > 0 && (
                                        <div onClick={(e) => { e.stopPropagation(); handleOverflowClick(d); }} className="text-xs text-text-secondary font-medium hover:text-primary cursor-pointer mt-1 bg-surface/50 rounded p-1 text-center">
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
                    <div className="bg-surface-container-high p-6 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-outline/10">
                        <div className="flex justify-between items-center mb-4 border-b border-outline/10 pb-2">
                            <h2 className="text-xl font-bold text-text-primary">
                                {dayViewDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </h2>
                            <button onClick={() => setDayViewDate(null)} className="text-text-secondary hover:text-text-primary p-2 hover:bg-surface-container-highest rounded-full">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {getEventsForDay(dayViewDate).map(event => renderEventItem(event, dayViewDate))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-outline/10 flex justify-end">
                            <button onClick={() => { setDayViewDate(null); handleDayClick(dayViewDate); }} className="bg-primary hover:bg-primary-hover text-on-primary px-4 py-2 rounded-full text-sm font-semibold shadow-md transition-colors">
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

            {previewEvent && (
                <JobPreviewModal 
                    event={previewEvent} 
                    onClose={() => setPreviewEvent(null)} 
                    users={users || []}
                    installers={installers || []}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

const JobPreviewModal: React.FC<{ 
    event: CalendarEvent; 
    onClose: () => void;
    users: User[];
    installers: Installer[];
    currentUser: any;
}> = ({ event, onClose, users, installers, currentUser }) => {
    
    const color = useEventColor(event, users, installers, currentUser);
    const fe = event.fullEvent || {};

    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const dateRange = startDate.toDateString() === endDate.toDateString()
        ? startDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
        : `${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={onClose}>
            <div className="bg-surface-container-high rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-outline/10" onClick={e => e.stopPropagation()}>
                <div className="h-2 w-full" style={{ backgroundColor: color }}></div>
                <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-start gap-3">
                            <div className="w-4 h-4 rounded mt-1.5 shrink-0" style={{ backgroundColor: color }}></div>
                            <div>
                                <h3 className="text-xl font-bold text-text-primary leading-tight">{event.title}</h3>
                                <p className="text-sm text-text-secondary mt-1">{dateRange}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary p-1 rounded-full hover:bg-surface-container-highest transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4 pl-7">
                        {event.type === 'material_order_eta' ? (
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 text-sm text-text-secondary">
                                    <Package size={18} className="text-text-tertiary shrink-0 mt-0.5" />
                                    <div>
                                        <p><span className="font-medium text-text-primary">Supplier:</span> {fe.supplierName}</p>
                                        <p><span className="font-medium text-text-primary">Status:</span> {fe.status}</p>
                                    </div>
                                </div>
                                {fe.items && Array.isArray(fe.items) && (
                                    <div className="space-y-2 mt-2">
                                        {fe.items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex gap-3 p-2 bg-surface-container-low rounded-lg border border-outline/10">
                                                <div className="w-10 h-10 bg-surface-container-highest rounded-md border border-outline/10 shrink-0 overflow-hidden">
                                                    {item.image ? (
                                                        <img src={getImageUrl(item.image)} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                                                            <Package size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-sm overflow-hidden">
                                                    <p className="font-medium text-text-primary truncate" title={item.name}>{item.name}</p>
                                                    <p className="text-xs text-text-secondary">{item.quantity} {item.unit}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {fe.address && (
                                    <div className="flex items-start gap-3 text-sm">
                                        <MapPin size={18} className="text-text-tertiary shrink-0 mt-0.5" />
                                        <a href={`https://maps.google.com/?q=${encodeURIComponent(fe.address)}`} target="_blank" rel="noreferrer" className="text-text-primary hover:underline hover:text-primary">
                                            {fe.address}
                                        </a>
                                    </div>
                                )}
                                <div className="flex items-start gap-3 text-sm text-text-secondary">
                                    <FileText size={18} className="text-text-tertiary shrink-0 mt-0.5" />
                                    <div>
                                        <p><span className="font-medium text-text-primary">Project:</span> {fe.projectName}</p>
                                        <p><span className="font-medium text-text-primary">Customer:</span> {event.customerName}</p>
                                        {fe.installerName && <p><span className="font-medium text-text-primary">Installer:</span> {fe.installerName}</p>}
                                    </div>
                                </div>
                                {fe.pinnedNotes && (
                                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm text-text-primary">
                                        <p className="text-xs font-bold text-yellow-600 mb-1 flex items-center gap-1">📌 IMPORTANT NOTES</p>
                                        <SmartMessage content={fe.pinnedNotes} />
                                    </div>
                                )}
                            </>
                        )}
                        <div className="pt-2 border-t border-border mt-2">
                            <Link to={`/projects/${event.id}`} className="inline-flex items-center gap-2 text-primary hover:text-primary-hover font-semibold text-sm">
                                Open Project Details <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
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

    const isOwner = !event || (currentUser && event.createdByUserId === currentUser.userId);
    const [isEditMode, setIsEditMode] = useState(!event); 

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
            setIsPublic(event.isPublic || false); 
            
            if (event.attendees) {
                const selectedAttendees = event.attendees.map(att => {
                    if (att.attendeeType === 'user') {
                        const user = (users || []).find(u => u.userId === att.attendeeId); 
                        let color = user?.color || null;
                        if (!color && currentUser && currentUser.userId === att.attendeeId) color = currentUser.preferences?.calendarColor;
                        return user ? { label: user.email, value: `user-${user.userId}`, type: 'user' as const, color } : null;
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
            const dateStr = formatDateForInput(selectedDate);
            setStartDate(dateStr);
            setEndDate(dateStr);
            setStartTime('09:00');
            setEndTime('10:00');
            setIsAllDay(false);
            setIsPublic(false);
            if (currentUser) {
                setAttendees([{ label: currentUser.email, value: `user-${currentUser.userId}`, type: 'user' as const, color: currentUser.preferences?.calendarColor }]);
            } else { setAttendees([]); }
        }
    }, [event, selectedDate, users, installers, currentUser]);

    const handleSave = async () => {
        if (!title) { toast.error("Title is required."); return; }
        setIsSaving(true);
        try {
            const timeZone = systemTimezone || 'America/Los_Angeles';
            let startDateTime: Date, endDateTime: Date;
            if (isAllDay) {
                startDateTime = fromZonedTime(`${startDate}T00:00:00`, timeZone);
                endDateTime = fromZonedTime(`${endDate}T23:59:59`, timeZone);
            } else {
                startDateTime = fromZonedTime(`${startDate}T${startTime}:00`, timeZone);
                endDateTime = fromZonedTime(`${endDate}T${endTime}:00`, timeZone);
            }
            const eventData = { title, notes, startTime: startDateTime.toISOString(), endTime: endDateTime.toISOString(), isAllDay, isPublic, jobId: null, attendees: attendees.map(opt => ({ attendeeId: opt.value.substring(opt.value.indexOf('-') + 1), attendeeType: opt.type })) };
            if (event) await eventService.updateEvent(event.id, eventData);
            else await eventService.createEvent(eventData);
            toast.success(event ? "Updated!" : "Created!");
            onSaveSuccess();
            onClose();
        } catch (error) { toast.error("Failed to save."); } finally { setIsSaving(false); }
    };
    
    const handleDelete = async () => {
        if (!event || !window.confirm("Delete this appointment?")) return;
        setIsDeleting(true);
        try {
            await eventService.deleteEvent(event.id);
            toast.success("Deleted.");
            onSaveSuccess();
            onClose();
        } catch (error) { toast.error("Failed to delete."); } finally { setIsDeleting(false); }
    };

    const handleRespond = async (status: 'accepted' | 'declined') => {
        if (!event) return;
        try {
            const res = await fetch(getEndpoint(`/api/events/${event.id}/respond`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }), credentials: 'include' });
            if (!res.ok) throw new Error("Failed");
            toast.success(`Invitation ${status}`);
            onSaveSuccess(); onClose();
        } catch (e) { toast.error("Could not update status"); }
    };

    if (!isOpen) return null;
    const myAttendeeRecord = event?.attendees?.find(a => a.attendeeType === 'user' && a.attendeeId === currentUser?.userId);
    const myStatus = (myAttendeeRecord as any)?.status || 'pending';
    const isPendingInvite = !!event && !isOwner && myAttendeeRecord && myStatus === 'pending';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-surface-container-high p-8 rounded-2xl shadow-2xl w-full max-w-lg relative border border-outline/10">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-text-primary">{!event ? 'New Appointment' : isEditMode ? 'Edit Appointment' : 'Appointment Details'}</h2>
                    <div className="flex items-center gap-2">
                        {event && !isEditMode && isOwner && (
                            <button onClick={() => setIsEditMode(true)} className="p-2 text-primary hover:bg-surface-container-highest rounded-full transition-colors" title="Edit"><Edit2 size={18} /></button>
                        )}
                        <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-container-highest transition-colors"><X size={20} /></button>
                    </div>
                </div>
                {!isEditMode && event ? (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold text-text-primary mb-1"><span dangerouslySetInnerHTML={{__html: stripMentions(event.title)}} /></h3>
                            <div className="flex items-center text-text-secondary text-sm"><Clock size={16} className="mr-2" />{new Date(event.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} - {new Date(event.endTime).toLocaleString([], { timeStyle: 'short' })}</div>
                            {event.isPublic && <div className="flex items-center text-xs text-primary mt-1"><Globe size={12} className="mr-1" /> Public Event</div>}
                        </div>
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline/10 max-h-60 overflow-y-auto"><SmartMessage content={event.notes || 'No notes provided.'} /></div>
                        <div>
                            <h4 className="text-sm font-semibold text-text-secondary mb-2">Attendees</h4>
                            <div className="flex flex-wrap gap-2">
                                {event.attendees?.map((att: any, idx: number) => {
                                    const isUser = att.attendeeType === 'user';
                                    const name = isUser ? users.find(u => u.userId === att.attendeeId)?.email : installers.find(i => String(i.id) === att.attendeeId)?.installerName;
                                    let Icon = Clock, colorClass = 'text-yellow-500';
                                    if (att.status === 'accepted') { Icon = Check; colorClass = 'text-green-500'; }
                                    if (att.status === 'declined') { Icon = XCircle; colorClass = 'text-red-500'; }
                                    return (
                                        <div key={idx} className="flex items-center bg-surface-container-highest border border-outline/10 px-3 py-1 rounded-full text-xs">
                                            <Icon size={12} className={`mr-1 ${colorClass}`} /><span className="text-text-primary">{name || 'Unknown'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {isPendingInvite && (
                            <div className="flex justify-end gap-3 pt-4 border-t border-outline/10">
                                <span className="text-sm text-text-secondary self-center mr-auto">You are invited:</span>
                                <button onClick={() => handleRespond('declined')} className="px-4 py-2 text-sm border border-error text-error rounded-full hover:bg-error/10 font-medium transition-colors">Decline</button>
                                <button onClick={() => handleRespond('accepted')} className="px-4 py-2 text-sm bg-success text-on-success rounded-full hover:bg-success-hover font-medium transition-colors">Accept</button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-text-secondary mb-1">Title</label><MentionInput value={title} onChange={setTitle} placeholder="Event Title..." singleLine /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-text-secondary">Start</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors mb-2" />{!isAllDay && <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" />}</div>
                            <div><label className="block text-sm font-medium text-text-secondary">End</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors mb-2" />{!isAllDay && <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 bg-surface-container-highest border-b-2 border-transparent rounded-t-md text-text-primary focus:outline-none focus:border-primary transition-colors" />}</div>
                        </div>
                        <div className="flex justify-between">
                            <div className="flex items-center space-x-2"><input type="checkbox" id="isAllDay" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="w-4 h-4 text-primary bg-surface-container-highest border-outline/20 rounded focus:ring-primary" /><label htmlFor="isAllDay" className="text-sm font-medium text-text-primary cursor-pointer">All Day</label></div>
                            <div className="flex items-center space-x-2"><input type="checkbox" id="isPublic" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 text-primary bg-surface-container-highest border-outline/20 rounded focus:ring-primary" /><label htmlFor="isPublic" className="text-sm font-medium text-text-primary cursor-pointer flex items-center">{isPublic ? <Globe size={14} className="mr-1"/> : <Lock size={14} className="mr-1"/>}{isPublic ? 'Public Event' : 'Private'}</label></div>
                        </div>
                        <div><label className="block text-sm font-medium text-text-secondary">Attendees</label><Select isMulti options={attendeeOptions} value={attendees} onChange={setAttendees} className="react-select-container mt-1" classNamePrefix="react-select" styles={{ control: (base) => ({ ...base, backgroundColor: 'var(--color-surface-container-highest)', borderColor: 'transparent', borderRadius: '0.5rem', padding: '0.2rem' }), input: (base) => ({ ...base, color: 'var(--color-text-primary)' }), multiValue: (base) => ({ ...base, backgroundColor: 'var(--color-surface-container-low)' }), multiValueLabel: (base) => ({ ...base, color: 'var(--color-text-primary)' }), menu: (base) => ({ ...base, backgroundColor: 'var(--color-surface-container-highest)' }), option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? 'var(--color-primary)' : isFocused ? 'var(--color-surface-container-highest)' : undefined, color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-primary)' }) }} /></div>
                        <div><label className="block text-sm font-medium text-text-secondary mb-1">Notes</label><MentionInput value={notes} onChange={setNotes} placeholder="Add notes..." minHeight={80} /></div>
                        <div className="mt-6 flex justify-end gap-4">
                            {event && (
                                <button type="button" onClick={handleDelete} disabled={isDeleting} className="py-2 px-4 bg-error-container hover:bg-error/20 text-error rounded-full font-semibold mr-auto flex items-center justify-center transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <button type="button" onClick={() => event ? setIsEditMode(false) : onClose()} className="py-2 px-6 bg-surface hover:bg-surface-container-highest border border-outline/20 rounded-full text-text-secondary font-medium transition-colors">Cancel</button>
                            <button type="button" onClick={handleSave} disabled={isSaving} className="py-2 px-6 bg-primary hover:bg-primary-hover rounded-full text-on-primary font-bold shadow-md transition-all">{isSaving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarView;