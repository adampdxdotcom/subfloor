import { useState, useEffect } from 'react';

// Tailwind Breakpoints:
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px

export const useGridColumns = () => {
    const [columns, setColumns] = useState(4); // Default to desktop

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 768) {
                setColumns(1); // Mobile
            } else if (width < 1024) {
                setColumns(2); // Tablet
            } else if (width < 1280) {
                setColumns(3); // Small Laptop
            } else {
                setColumns(4); // Large Desktop (xl)
            }
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return columns;
};