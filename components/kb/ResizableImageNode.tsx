import React, { useRef, useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

export default function ResizableImageNode(props: NodeViewProps) {
    const { node, updateAttributes, selected } = props;
    const [isResizing, setIsResizing] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);
    const startX = useRef(0);
    const startWidth = useRef(0);

    // --- MOUSE HANDLERS ---
    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (imageRef.current) {
            setIsResizing(true);
            startX.current = e.clientX;
            startWidth.current = imageRef.current.offsetWidth;
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    };

    const onMouseMove = useCallback((e: MouseEvent) => {
        const currentX = e.clientX;
        const diffX = currentX - startX.current;
        const newWidth = Math.max(100, startWidth.current + diffX); // Min 100px
        
        // Update attributes directly here to see it live.
        updateAttributes({ width: newWidth });
    }, [updateAttributes]);

    const onMouseUp = useCallback(() => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }, [onMouseMove]);

    // --- TOUCH HANDLERS (Mobile) ---
    const onTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation(); // Don't scroll page
        
        if (imageRef.current) {
            setIsResizing(true);
            startX.current = e.touches[0].clientX;
            startWidth.current = imageRef.current.offsetWidth;
            
            document.addEventListener('touchmove', onTouchMove as any, { passive: false });
            document.addEventListener('touchend', onTouchEnd as any);
        }
    };

    const onTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault(); // Prevent scrolling while resizing
        const currentX = e.touches[0].clientX;
        const diffX = currentX - startX.current;
        const newWidth = Math.max(100, startWidth.current + diffX);
        
        updateAttributes({ width: newWidth });
    }, [updateAttributes]);

    const onTouchEnd = useCallback(() => {
        setIsResizing(false);
        document.removeEventListener('touchmove', onTouchMove as any);
        document.removeEventListener('touchend', onTouchEnd as any);
    }, [onTouchMove]);

    const align = node.attrs.align || 'center';
    
    // Calculate styles based on alignment
    let style: React.CSSProperties = {};
    if (align === 'left') style = { float: 'left', marginRight: '1rem' };
    else if (align === 'right') style = { float: 'right', marginLeft: '1rem' };
    else style = { display: 'block', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' };

    return (
        <NodeViewWrapper className="relative transition-all my-4 mb-8" style={style}>
            <div className={`relative inline-block group ${selected || isResizing ? 'ring-2 ring-primary rounded' : ''}`}>
                <img
                    ref={imageRef}
                    src={node.attrs.src}
                    alt={node.attrs.alt}
                    title={node.attrs.title}
                    width={node.attrs.width}
                    className="block rounded max-w-full h-auto"
                />
                
                {/* Drag Handle (Bottom Right) - Visible on Hover or Select */}
                <div
                    className={`absolute bottom-2 right-2 w-6 h-6 md:w-4 md:h-4 bg-primary border-2 border-white rounded-full cursor-nwse-resize shadow-md
                        ${selected || isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                />
                
                {/* Resolution Overlay (Optional, shows while resizing) */}
                {isResizing && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
                        {node.attrs.width}px
                    </div>
                )}
            </div>
            
            {/* CAPTION INPUT (Visible when selected or has content) */}
            {(selected || node.attrs.caption) && (
                <div className={`text-center mt-2 ${selected ? 'opacity-100' : 'opacity-70'} transition-opacity`}>
                    <input 
                        className="bg-transparent text-center text-sm text-text-secondary placeholder-text-tertiary border-none focus:ring-0 focus:outline-none w-full italic"
                        placeholder="Add a caption..."
                        value={node.attrs.caption || ''}
                        onChange={(e) => updateAttributes({ caption: e.target.value })}
                        onMouseDown={(e) => e.stopPropagation()} // Prevent dragging image when clicking input
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </NodeViewWrapper>
    );
}