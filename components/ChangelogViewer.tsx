import React, { useMemo, useState } from 'react';
import { changelogData } from '../data/changelog';
import { Search, GitCommit, Zap, Bug, Settings, Star, ChevronRight } from 'lucide-react';

const TYPE_ICONS = {
  major: Star,
  feature: Zap,
  fix: Bug,
  infrastructure: Settings
};

const TYPE_COLORS = {
  major: 'text-on-tertiary-container bg-tertiary-container border-tertiary-container/50',
  feature: 'text-on-secondary-container bg-secondary-container border-secondary-container/50',
  fix: 'text-on-primary-container bg-primary-container border-primary-container/50',
  infrastructure: 'text-text-secondary bg-surface-container-highest border-outline/50'
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
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">System Updates</h2>
          <p className="text-text-secondary">Track the evolution of the platform.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
          <input 
            type="text" 
            placeholder="Search changes..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-surface-container-high border-none rounded-full text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow shadow-sm hover:shadow-md placeholder:text-text-tertiary"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative border-l-2 border-outline/10 ml-3 md:ml-6 space-y-12 pb-12">
        {filteredData.map((entry, index) => {
          const Icon = TYPE_ICONS[entry.type] || GitCommit;
          const isLatest = index === 0 && !search;

          return (
            <div key={entry.version} className="relative pl-6 md:pl-12">
              {/* Timeline Dot */}
              <div className={`absolute -left-[9px] top-0 md:top-6 w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center z-10 ${
                isLatest ? 'bg-primary scale-125' : 'bg-surface-container-highest text-text-secondary border-outline/20'
              }`}>
                {isLatest ? <div className="w-2 h-2 bg-on-primary rounded-full animate-pulse" /> : null}
              </div>

              {/* Content Card */}
              <div className={`group relative transition-all md:p-6 md:rounded-2xl md:border ${
                isLatest 
                  ? 'md:bg-surface-container-high md:border-primary/40 md:shadow-lg md:shadow-primary/10' 
                  : 'md:bg-surface-container-low md:border-outline/10 hover:md:border-primary/40 hover:md:shadow-md'
              }`}>
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-3 md:mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border capitalize flex items-center gap-1.5 ${TYPE_COLORS[entry.type]}`}>
                        <Icon size={12} />
                        {entry.type}
                      </span>
                      <span className="text-sm font-mono text-text-tertiary">{entry.version}</span>
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mt-1">{entry.title}</h3>
                  </div>
                  <div className="text-xs md:text-sm text-text-secondary font-medium bg-surface-container-highest self-start md:self-auto px-3 py-1 rounded-lg border border-outline/10">
                    {entry.date}
                  </div>
                </div>

                {/* Changes List */}
                <ul className="space-y-3 md:space-y-2 pl-1">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-3 text-text-secondary group-hover:text-text-primary transition-colors">
                      <span className="mt-2.5 md:mt-2 w-1.5 h-1.5 rounded-full bg-outline/30 group-hover:bg-primary shrink-0 transition-colors" />
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