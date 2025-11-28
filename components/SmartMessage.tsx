import React from 'react';
import { Link } from 'react-router-dom';

interface SmartMessageProps {
    content: string;
}

// Regex to find @[type:id|label]
// Capturing groups: 1=type, 2=id, 3=label
const TAG_REGEX = /@\[(product|project|user|customer|installer):([^|]+)\|([^\]]+)\]/g;

const SmartMessage: React.FC<SmartMessageProps> = ({ content }) => {
    if (!content) return null;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = TAG_REGEX.exec(content)) !== null) {
        // Push text before the match
        if (match.index > lastIndex) {
            parts.push(content.substring(lastIndex, match.index));
        }

        const [fullMatch, type, id, label] = match;

        // Render specific tag types
        if (type === 'project') {
            parts.push(
                <Link 
                    key={match.index} 
                    to={`/projects/${id}`} 
                    className="inline-flex items-center text-indigo-700 font-medium hover:underline bg-indigo-100 px-1.5 py-0.5 rounded text-xs mx-0.5 align-baseline"
                >
                    📁 {label}
                </Link>
            );
        } else if (type === 'product') {
            // Link to library with search param
            parts.push(
                <Link 
                    key={match.index} 
                    to={`/samples?search=${encodeURIComponent(label)}`} 
                    className="inline-flex items-center text-teal-700 font-medium hover:underline bg-teal-100 px-1.5 py-0.5 rounded text-xs mx-0.5 align-baseline"
                >
                    🎨 {label}
                </Link>
            );
        } else if (type === 'user') {
            parts.push(
                <span 
                    key={match.index} 
                    className="inline-flex items-center text-blue-700 font-medium bg-blue-100 px-1.5 py-0.5 rounded text-xs mx-0.5 align-baseline cursor-default"
                >
                    @{label}
                </span>
            );
        } else if (type === 'customer') {
            parts.push(
                <Link 
                    key={match.index} 
                    to={`/customers/${id}`} 
                    className="inline-flex items-center text-amber-700 font-medium hover:underline bg-amber-100 px-1.5 py-0.5 rounded text-xs mx-0.5 align-baseline"
                >
                    👤 {label}
                </Link>
            );
        } else if (type === 'installer') {
            parts.push(
                <Link 
                    key={match.index} 
                    to={`/installers/${id}`} 
                    className="inline-flex items-center text-pink-700 font-medium hover:underline bg-pink-100 px-1.5 py-0.5 rounded text-xs mx-0.5 align-baseline"
                >
                    👷 {label}
                </Link>
            );
        } else {
            // Fallback for unknown types
            parts.push(fullMatch);
        }

        lastIndex = TAG_REGEX.lastIndex;
    }

    // Push remaining text
    if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
    }

    return <span className="whitespace-pre-wrap leading-relaxed">{parts}</span>;
};

export default SmartMessage;