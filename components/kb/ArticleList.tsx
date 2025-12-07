import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { FileText, Hash } from 'lucide-react'; // Hash icon for sections

export default forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      // Pass both ID and ANCHOR if available
      props.command({ 
          id: item.id, 
          label: item.label, // Backend now sends 'label' not 'title' for search results
          anchor: item.anchor 
      });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  const query = props.query || ""; 
  const hasItems = props.items.length > 0;

  return (
    <div className="bg-surface border border-border rounded-lg shadow-xl overflow-hidden min-w-[200px] z-50 flex flex-col">
      {hasItems ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`flex items-center gap-2 text-left px-3 py-2 text-sm w-full transition-colors ${
              index === selectedIndex ? 'bg-primary text-on-primary' : 'bg-surface text-text-primary hover:bg-background'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            {/* Icon Logic */}
            {item.type === 'section' ? (
                <Hash size={14} className={index === selectedIndex ? 'text-on-primary' : 'text-text-secondary'} />
            ) : (
                <FileText size={14} className={index === selectedIndex ? 'text-on-primary' : 'text-text-secondary'} />
            )}
            
            <div className="flex flex-col min-w-0">
                <span className="truncate font-medium">{item.label}</span>
                {item.type === 'section' && <span className="text-[10px] opacity-70">Section</span>}
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-text-secondary italic">
            {query.length === 0 ? "Start typing to search..." : "No articles found."}
        </div>
      )}
    </div>
  );
});