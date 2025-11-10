import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// --- NEW: Define a type for the data from our dedicated calendar endpoint ---
interface CalendarEvent {
    id: number; // This is the project_id
    title: string;
    start: string;
    end: string;
    customerName: string;
    backgroundColor: string | null;
}

// Helper function to normalize dates to midnight for accurate comparisons
const normalizeDate = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

// Calculates if a background color is light or dark and returns a contrasting text color.
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
    // --- MODIFICATION: Component no longer needs the full DataContext. It manages its own state. ---
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    // --- MODIFICATION: Fetch data from our new dedicated endpoint ---
    useEffect(() => {
        const fetchCalendarEvents = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/calendar/events');
                if (!response.ok) {
                    throw new Error('Failed to fetch calendar events');
                }
                const data: CalendarEvent[] = await response.json();
                setEvents(data);
            } catch (error) {
                console.error(error);
                // Optionally set an error state here to show in the UI
            } finally {
                setIsLoading(false);
            }
        };

        fetchCalendarEvents();
    }, []); // Fetch only once when the component mounts

    // --- All calendar grid calculation logic remains the same ---
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
    
    // --- MODIFICATION: This function now filters our simple 'events' state ---
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
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronLeft/></button>
                <h1 className="text-2xl font-bold text-text-primary">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h1>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronRight/></button>
            </div>

            <div className="grid grid-cols-7 text-center font-semibold text-text-secondary border-b border-border pb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 grid-rows-6 flex-1">
                {days.map((d, i) => {
                    const eventsForDay = getEventsForDay(d);
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();

                    return (
                        <div key={i} className={`border border-border flex flex-col ${isCurrentMonth ? '' : 'bg-gray-800 text-gray-500'}`}>
                            <span className={`font-semibold mb-1 self-start p-1 ${isToday(d) ? 'bg-accent text-white rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                                {d.getDate()}
                            </span>
                            <div className="flex-1 overflow-hidden space-y-1">
                                {/* --- MODIFICATION: Logic is much simpler, no more lookups --- */}
                                {eventsForDay.map(event => {
                                    const jobColor = event.backgroundColor || '#6b7280';
                                    const textColor = getContrastingTextColor(jobColor);

                                    const jobStart = normalizeDate(new Date(event.start));
                                    const jobEnd = normalizeDate(new Date(event.end));
                                    const currentDay = normalizeDate(d);
                                    
                                    const isStartDate = currentDay.getTime() === jobStart.getTime();
                                    const isEndDate = currentDay.getTime() === jobEnd.getTime();
                                    const isStartOfWeek = d.getDay() === 0;
                                    
                                    const showLabel = isStartDate || isStartOfWeek;
                                    
                                    let classNames = 'block text-xs p-1 truncate'; 
                                    if (isStartDate && isEndDate) classNames += ' rounded-md mx-1';
                                    else if (isStartDate) classNames += ' rounded-l-md ml-1';
                                    else if (isEndDate) classNames += ' rounded-r-md mr-1';

                                    return (
                                        <Link 
                                            to={`/projects/${event.id}`} 
                                            key={event.id} 
                                            className={classNames}
                                            style={{ backgroundColor: jobColor, color: textColor }}
                                        >
                                            {showLabel ? `${event.title} (${event.customerName.split(' ')[0]})` : '\u00A0'}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarView;