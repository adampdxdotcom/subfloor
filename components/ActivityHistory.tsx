import React from 'react';
import { ActivityLogEntry } from '../types';
import { Clock, User, History as HistoryIcon, Move } from 'lucide-react';
import { generateChangeDescriptions } from '../utils/changeFormatter';

interface ActivityHistoryProps {
  history: ActivityLogEntry[];
}

const ActivityHistory: React.FC<ActivityHistoryProps> = ({ history }) => {
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getActionText = (entry: ActivityLogEntry) => {
    const entityName = entry.targetEntity.toLowerCase().replace('_', ' ');

    switch (entry.actionType.toUpperCase()) {
      case 'CREATE':
        return `created the ${entityName}.`;
      case 'UPDATE':
        return `updated the ${entityName}.`;
      case 'DELETE':
        return `deleted the ${entityName}.`;
      default:
        return `${entry.actionType.toLowerCase().replace('_', ' ')} the ${entityName}.`;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* CARD HEADER */}
      <div className="p-4 border-b border-outline/10 flex items-center gap-3 flex-shrink-0">
          <Move className="drag-handle cursor-move text-text-secondary hover:text-text-primary transition-colors" size={20} />
          <HistoryIcon className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-semibold text-text-primary">Change History</h3>
      </div>

      {/* CARD BODY */}
      <div className="p-4 overflow-y-auto flex-grow bg-surface-container scrollbar-thin scrollbar-thumb-surface-container-highest">
        {!history || history.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No history available for this item.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => {
              const changes = entry.actionType.toUpperCase() === 'UPDATE' && entry.details?.before && entry.details?.after
                ? generateChangeDescriptions(entry.details.before, entry.details.after)
                : [];

              return (
                <div key={entry.id} className="flex items-start p-3 bg-surface-container-high rounded-xl">
                  <div className="flex-shrink-0 mr-3 mt-1">
                    <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-container text-on-primary-container">
                      <User size={16} />
                    </span>
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-semibold text-text-primary">
                      {entry.userEmail || 'Unknown User'}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {getActionText(entry)}
                    </p>

                    {changes.length > 0 && (
                      <ul className="mt-2 pl-5 list-disc space-y-1 text-sm text-text-secondary marker:text-primary/50">
                        {changes.map((change, index) => (
                          <li key={index}>{change}</li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center mt-2 text-xs text-text-tertiary">
                      <Clock size={12} className="mr-1.5" />
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityHistory;