// components/ActivityHistory.tsx

import React from 'react';
import { ActivityLogEntry } from '../types';
import { Clock, User } from 'lucide-react';
import { generateChangeDescriptions } from '../utils/changeFormatter'; // <-- MODIFIED: Import the new helper

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

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-4 text-text-secondary">
        <p>No history available for this item.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => {
        // vvvvvvvvvvvv MODIFIED: Generate change descriptions for UPDATE actions vvvvvvvvvvvv
        const changes = entry.actionType.toUpperCase() === 'UPDATE' && entry.details?.before && entry.details?.after
          ? generateChangeDescriptions(entry.details.before, entry.details.after)
          : [];
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

        return (
          <div key={entry.id} className="flex items-start p-3 bg-background rounded-md shadow-sm">
            <div className="flex-shrink-0 mr-3 mt-1">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-surface text-accent">
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

              {/* vvvvvvvvvvvv MODIFIED: Render the list of changes if they exist vvvvvvvvvvvv */}
              {changes.length > 0 && (
                <ul className="mt-2 pl-5 list-disc space-y-1 text-sm text-text-secondary">
                  {changes.map((change, index) => (
                    <li key={index}>{change}</li>
                  ))}
                </ul>
              )}
              {/* ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */}

              <div className="flex items-center mt-2 text-xs text-text-tertiary">
                <Clock size={12} className="mr-1.5" />
                <span>{formatDate(entry.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityHistory;