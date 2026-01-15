import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const elRef = useRef<HTMLDivElement | null>(null);

    if (!elRef.current) {
        elRef.current = document.createElement('div');
    }

    useEffect(() => {
        const el = elRef.current!;
        document.body.appendChild(el);
        return () => {
            document.body.removeChild(el);
        };
    }, []);

    return createPortal(children, elRef.current);
};

export default ModalPortal;