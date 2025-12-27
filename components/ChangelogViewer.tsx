import React, { useMemo, useState } from 'react';
import { changelogData, ChangelogEntry } from '../data/changelog';
import { Search, GitCommit, Zap, Bug, Settings, Star } from 'lucide-react';

const TYPE_ICONS = {
  major: Star,
  feature: Zap,
  fix: Bug,
  infrastructure: Settings
};

const TYPE_COLORS = {
  major: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  feature: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  fix: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  infrastructure: 'text-slate-500 bg-slate-500/10 border-slate-500/20'
};

export const ChangelogViewer: React.FC = () => {
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!search) return changelogData;
    const lower = search.toLowerCase();
    return changelogData.filter(entry => 
      entry.title.toLowerCase().includes(lower) || 
      entry.version.toLowerCase().includes(lower) ||
      entry.changes.some(c => c.toLowerCase().includes(lower))
    );
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">System Updates</h2>
          <p className="text-text-secondary">Track the evolution of the platform.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input 
            type="text" 
            placeholder="Search changes..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-text-primary w-full md:w-64 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative border-l-2 border-border ml-3 md:ml-6 space-y-12 pb-12">
        {filteredData.map((entry, index) => {
          const Icon = TYPE_ICONS[entry.type] || GitCommit;
          const isLatest = index === 0 && !search;

          return (
            <div key={entry.version} className="relative pl-8 md:pl-12">
              {/* Timeline Dot */}
              <div className={`absolute -left-[9px] top-1 w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center ${
                isLatest ? 'bg-primary text-white scale-125' : 'bg-surface-highlight text-text-secondary border-border'
              }`}>
                {isLatest ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> : null}
              </div>

              {/* Content Card */}
              <div className={`group relative bg-surface border rounded-xl p-5 transition-all ${
                isLatest 
                  ? 'border-primary/30 shadow-lg shadow-primary/5 ring-1 ring-primary/20' 
                  : 'border-border hover:border-primary/30 hover:shadow-md'
              }`}>
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border capitalize flex items-center gap-1.5 ${TYPE_COLORS[entry.type]}`}>
                        <Icon size={12} />
                        {entry.type}
                      </span>
                      <span className="text-sm font-mono text-text-tertiary">{entry.version}</span>
                    </div>
                    <h3 className="text-lg font-bold text-text-primary">{entry.title}</h3>
                  </div>
                  <div className="text-sm text-text-secondary font-medium bg-surface-highlight px-3 py-1 rounded-lg border border-border">
                    {entry.date}
                  </div>
                </div>

                {/* Changes List */}
                <ul className="space-y-2">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-3 text-text-secondary group-hover:text-text-primary transition-colors">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-border group-hover:bg-primary shrink-0 transition-colors" />
                      <span className="leading-relaxed">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        {filteredData.length === 0 && (
            <div className="pl-12 text-text-secondary italic">No updates found matching your search.</div>
        )}
      </div>
    </div>
  );
};