import React, { useMemo } from 'react';
import { MentionsInput, Mention } from 'react-mentions';
import { useUsers } from '../hooks/useUsers';
import { useProjects } from '../hooks/useProjects';
import { useProducts } from '../hooks/useProducts';
import { useCustomers } from '../hooks/useCustomers';
import { useInstallers } from '../hooks/useInstallers';

interface MentionInputProps {
    value: string;
    onChange: (newValue: string) => void;
    placeholder?: string;
    onKeyDown?: (e: any) => void;
    minHeight?: number;
    maxHeight?: number;
    rightElement?: React.ReactNode; 
    singleLine?: boolean;
}

const MentionInput: React.FC<MentionInputProps> = ({ value, onChange, placeholder, onKeyDown, minHeight = 40, maxHeight = 120, rightElement, singleLine = false }) => {
    // Fetch all data sources required for mentions
    const { data: users = [] } = useUsers();
    const { data: projects = [] } = useProjects();
    const { data: products = [] } = useProducts();
    const { data: customers = [] } = useCustomers();
    const { data: installers = [] } = useInstallers();

    // Transform data for react-mentions
    const usersData = useMemo(() => users.map(u => ({ id: u.userId, display: u.firstName ? `${u.firstName} ${u.lastName}` : u.email })), [users]);
    const projectsData = useMemo(() => projects.map(p => ({ id: String(p.id), display: p.projectName })), [projects]);
    const productsData = useMemo(() => products.map(p => ({ id: p.id, display: p.name })), [products]);
    const customersData = useMemo(() => customers.map(c => ({ id: String(c.id), display: c.fullName })), [customers]);
    const installersData = useMemo(() => installers.map(i => ({ id: String(i.id), display: i.installerName })), [installers]);

    // --- STYLES (Using CSS Variables for Theme Support) ---
    const style = {
        control: {
            fontSize: 14,
            fontWeight: 'normal',
        },
        // Standard Multi-line (Notes)
        '&multiLine': {
            control: {
                fontFamily: 'inherit',
                minHeight: singleLine ? undefined : minHeight,
                maxHeight: singleLine ? undefined : maxHeight,
            },
            highlighter: {
                padding: 12,
                border: '1px solid transparent',
            },
            input: {
                padding: 12,
                border: '1px solid var(--color-outline-variant, #49454F)',
                borderRadius: '0.75rem', // 12px
                backgroundColor: 'var(--color-surface-container, #1F1B16)', 
                color: 'var(--color-text-primary)',
                overflow: 'auto',
                height: '100%',
                outline: 'none',
            },
        },
        // Single-line (Title)
        '&singleLine': {
            display: 'inline-block',
            width: '100%',
            highlighter: {
                padding: 12,
                border: '2px solid transparent',
            },
            input: {
                padding: 12,
                border: '1px solid var(--color-outline-variant, #49454F)',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--color-surface-container, #1F1B16)', 
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
            },
        },
        suggestions: {
            list: {
                backgroundColor: 'var(--color-surface-container-high, #2A2826)',
                border: '1px solid var(--color-outline, #9C8F83)',
                borderRadius: '0.75rem',
                fontSize: 12,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                zIndex: 99999, 
                width: 250,
                maxHeight: 200,
                overflow: 'auto',
                marginTop: 4
            },
            item: {
                padding: '8px 12px',
                borderBottom: '1px solid var(--color-outline-variant, #49454F)',
                color: 'var(--color-text-secondary)',
                '&focused': {
                    backgroundColor: 'var(--color-primary-container, #51443B)',
                    color: 'var(--color-on-primary-container, #FFDDB7)',
                },
            },
        },
    };

    const renderSuggestion = (entry: any, search: string, highlightedDisplay: React.ReactNode, index: number, focused: boolean) => {
        return (
            <div className={`flex items-center gap-2 ${focused ? 'font-bold' : ''}`}>
               <span>{highlightedDisplay}</span>
            </div>
        );
    };

    return (
        <div className="mention-input-wrapper w-full flex flex-col gap-2">
            <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0 relative">
                    <MentionsInput
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        style={style}
                        onKeyDown={onKeyDown}
                        allowSpaceInQuery
                        className="flex-1"
                        singleLine={singleLine}
                        suggestionsPortalHost={document.body}
                    >
                        {/* @ USER */}
                        <Mention
                            trigger="@"
                            data={usersData}
                            markup="@[user:__id__|__display__]"
                            style={{ backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)', borderRadius: 4, padding: '1px 3px' }} 
                            renderSuggestion={renderSuggestion}
                            displayTransform={(id, display) => `@${display}`}
                        />
                        
                        {/* ! PROJECT */}
                        <Mention
                            trigger="!"
                            data={projectsData}
                            markup="@[project:__id__|__display__]"
                            style={{ backgroundColor: 'var(--color-tertiary-container)', color: 'var(--color-on-tertiary-container)', borderRadius: 4, padding: '1px 3px' }} 
                            renderSuggestion={renderSuggestion}
                            displayTransform={(id, display) => `📁 ${display}`}
                        />

                        {/* # PRODUCT */}
                        <Mention
                            trigger="#"
                            data={productsData}
                            markup="@[product:__id__|__display__]"
                            style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', borderRadius: 4, padding: '1px 3px' }} 
                            renderSuggestion={renderSuggestion}
                            displayTransform={(id, display) => `🎨 ${display}`}
                        />

                        {/* \ CUSTOMER */}
                        <Mention
                            trigger="\"
                            data={customersData}
                            markup="@[customer:__id__|__display__]"
                            style={{ backgroundColor: 'var(--color-error-container)', color: 'var(--color-on-error-container)', borderRadius: 4, padding: '1px 3px' }} 
                            renderSuggestion={renderSuggestion}
                            displayTransform={(id, display) => `👤 ${display}`}
                        />

                        {/* + INSTALLER */}
                        <Mention
                            trigger="+"
                            data={installersData}
                            markup="@[installer:__id__|__display__]"
                            style={{ backgroundColor: 'var(--color-surface-variant)', color: 'var(--color-on-surface-variant)', borderRadius: 4, padding: '1px 3px' }} 
                            renderSuggestion={renderSuggestion}
                            displayTransform={(id, display) => `👷 ${display}`}
                        />
                    </MentionsInput>
                </div>
                {rightElement && <div className="shrink-0 pb-1">{rightElement}</div>}
            </div>

            {!singleLine && (
                <div className="flex flex-wrap gap-3 text-[10px] text-text-secondary px-1">
                    <div className="flex items-center gap-1 cursor-help" title="Mention a User"><span className="font-mono bg-surface-container-highest border border-outline/20 px-1 rounded">@</span> User</div>
                    <div className="flex items-center gap-1 cursor-help" title="Link a Project"><span className="font-mono bg-surface-container-highest border border-outline/20 px-1 rounded">!</span> Project</div>
                    <div className="flex items-center gap-1 cursor-help" title="Link a Product"><span className="font-mono bg-surface-container-highest border border-outline/20 px-1 rounded">#</span> Product</div>
                    <div className="flex items-center gap-1 cursor-help" title="Link a Customer"><span className="font-mono bg-surface-container-highest border border-outline/20 px-1 rounded">\</span> Customer</div>
                    <div className="flex items-center gap-1 cursor-help" title="Link an Installer"><span className="font-mono bg-surface-container-highest border border-outline/20 px-1 rounded">+</span> Installer</div>
                </div>
            )}
        </div>
    );
};

export default MentionInput;