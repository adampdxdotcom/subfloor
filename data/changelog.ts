export interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    type: 'major' | 'feature' | 'fix' | 'infrastructure';
    changes: string[];
}

export const changelogData: ChangelogEntry[] = [
    {
        version: "Version 2.0",
        date: "December 27, 2025",
        title: "Establish Update Notifications",
        type: "feature",
        changes: [
            "Created a system that checks in to a central location to determine if an update is available.",
            "Users are presented with a link to update instructions."
        ]
    },
    {
        version: "Session 34",
        date: "Current",
        title: "System Email Customization",
        type: "feature",
        changes: [
            "Added 'Message Templates' to Settings > Communications.",
            "Implemented a full Rich Text Editor for system emails.",
            "Added variable support (e.g., {{customer_name}}) for dynamic content.",
            "Created database-backed template storage with file-system fallbacks."
        ]
    },
    {
        version: "Session 33",
        date: "Recent",
        title: "Connected Operating System",
        type: "major",
        changes: [
            "Universal Search 2.0: Smart detection of products vs variants.",
            "iCal Subscription: Sync Job/Delivery schedule to Google/Apple Calendar.",
            "Pinned Job Notes: Highlight critical info (Gate Codes) in chat and calendar.",
            "Dashboard Logistics: Visual 'Selected Variants' gallery and Date Ranges on cards.",
            "Interactive Calendar Pop-ups: Preview events without page reloads."
        ]
    },
    {
        version: "Session 32.5",
        date: "Mobile Sprint",
        title: "Native Android & Hardware Integration",
        type: "infrastructure",
        changes: [
            "Native Android App (Capacitor) released.",
            "Hardware Integration: 'Notch' handling, Safe Area layouts, and Back Button logic.",
            "Warehouse Scanner: Rear-camera optimization, Flashlight toggle, and Laser UI.",
            "Offline-Ready Architecture: 'Server Connect' screen for dynamic API URLs."
        ]
    },
    {
        version: "Session 31",
        date: "Mobile Sprint",
        title: "Mobile UX & Calendar Overhaul",
        type: "feature",
        changes: [
            "Mobile Agenda View: Replaced grid with a touch-friendly list for phones.",
            "Advanced Filtering: Full-screen mobile filter for Users/Installers.",
            "Full-Screen Sheets: Standardized modal interactions for small screens."
        ]
    },
    {
        version: "Session 30",
        date: "Logistics Sprint",
        title: "Warehouse & Mobile Operations",
        type: "major",
        changes: [
            "App-ification: Viewport locking and touch optimizations.",
            "Receive Order 2.0: Mobile-first photo upload and file accumulation.",
            "Mobile Dashboard: Expanded touch targets and simplified cards.",
            "Fixed Timezone bugs causing dates to appear as 'Yesterday'."
        ]
    },
    {
        version: "Session 29",
        date: "Workflow Sprint",
        title: "Advanced Logistics & Financials",
        type: "feature",
        changes: [
            "Interest Tracking: Link specific colors to generic sample boards.",
            "'Early Access' Jobs: Create notes/photos before a quote is accepted.",
            "Financial Integration: Link Appointments to specific PO Numbers.",
            "Direct Checkouts: Assign samples to Leads or Installers without a Project."
        ]
    },
    {
        version: "Session 28",
        date: "Automation Sprint",
        title: "Automated Reminders & Printing",
        type: "feature",
        changes: [
            "Automated Job Reminders: T-Minus 2 Day alerts for customers.",
            "Team Calendar: Invite system with Accept/Decline status.",
            "Printing Infrastructure: Unified Print Queue for labels/QR codes."
        ]
    },
    {
        version: "Session 27",
        date: "Scheduling Sprint",
        title: "Robust Team Scheduling",
        type: "major",
        changes: [
            "Fixed critical data-loss bug in Job Details save.",
            "Event Visibility Rules: Public vs Private vs Invited.",
            "Installer Management: Managed vs Unmanaged (Subcontractor) types."
        ]
    },
    {
        version: "Session 26",
        date: "Data Sprint",
        title: "Supply Chain & Smart Forms",
        type: "feature",
        changes: [
            "Supply Chain Logic: Auto-link Brands to Default Suppliers.",
            "Smart Forms: Dynamic inputs for Tile (Packaging) vs Carpet (Rolls).",
            "System Status Ticker: Real-time feedback bar in the header.",
            "Vendor CRM: Digital footprint tracking (Portals/Websites)."
        ]
    },
    {
        version: "Session 25",
        date: "Stability Sprint",
        title: "Infrastructure Repairs",
        type: "fix",
        changes: [
            "Fixed Production File Upload paths.",
            "Product Duplication: Deep-copy product lines and variants.",
            "Unified Modals: Standardized Installer and Product editing.",
            "Restored 'On-the-Fly' creation in Quick Checkout."
        ]
    },
    {
        version: "Session 24",
        date: "Feature Sprint",
        title: "Knowledge Base (Wiki)",
        type: "major",
        changes: [
            "Full CMS: Rich text editor with image resizing and tables.",
            "Smart Linking: Use '[[' to link between articles.",
            "Version History: 'Time Machine' to revert content changes.",
            "Mobile-First Reading Experience."
        ]
    },
    {
        version: "Session 21",
        date: "DevOps",
        title: "Zero-Config Setup",
        type: "infrastructure",
        changes: [
            "Self-Healing Infrastructure.",
            "First-Run Wizard for Admin setup.",
            "Dynamic Database Initialization."
        ]
    },
    {
        version: "Session 20",
        date: "Performance",
        title: "Performance Architecture",
        type: "infrastructure",
        changes: [
            "React Query Migration: Instant cache-based navigation.",
            "Virtualization: Rendering thousands of rows with zero lag.",
            "Image Optimization Pipeline (Sharp)."
        ]
    },
    {
        version: "Session 19",
        date: "Feature Sprint",
        title: "Intelligence & Collaboration",
        type: "major",
        changes: [
            "Universal Import Tool: Excel/CSV parsing with column mapping.",
            "Central Messaging: Direct Chat and Notifications.",
            "Smart Mentions: Use @User, !Project, #Product in text.",
            "Business Intelligence: Revenue trends and charts."
        ]
    },
    {
        version: "Session 16",
        date: "Production",
        title: "Production Build",
        type: "infrastructure",
        changes: [
            "Discontinued Samples subsystem.",
            "Monolith Container architecture.",
            "Hardened Backup & Restore tools."
        ]
    },
    {
        version: "Session 15",
        date: "UI Sprint",
        title: "Branding & Theming",
        type: "feature",
        changes: [
            "White-Label Engine: Custom Logo and Favicon uploads.",
            "Theme Engine: Semantic CSS variables for Light/Dark modes.",
            "System-wide UI refactor ('The Scrub')."
        ]
    },
    {
        version: "Session 14",
        date: "Feature Sprint",
        title: "User Identity & Pricing",
        type: "major",
        changes: [
            "User Profiles: Avatars and Name management.",
            "Pricing Engine: Cost vs Retail with Markup/Margin logic.",
            "Product Variants: Advanced packaging data (Cartons/SF).",
            "Advanced Material Ordering with Unit Conversion."
        ]
    },
    {
        version: "Session 13",
        date: "Feature Sprint",
        title: "Email Automation",
        type: "feature",
        changes: [
            "Internal Daily Update emails.",
            "Automated Customer Reminders (Due Tomorrow/Past Due).",
            "System vs User Preference architecture split."
        ]
    },
    {
        version: "Session 12",
        date: "Feature Sprint",
        title: "Calendar & Appointments",
        type: "major",
        changes: [
            "User-Specific Calendar Colors.",
            "Multi-Entity Attendees (Users + Installers).",
            "Unified Calendar Filter."
        ]
    },
    {
        version: "Session 11",
        date: "UI Sprint",
        title: "Project Dashboard Refactor",
        type: "feature",
        changes: [
            "Draggable/Resizable Dashboard Widgets.",
            "Edit Mode with user preference persistence.",
            "Grid Layout implementation."
        ]
    },
    {
        version: "Session 10",
        date: "Data Sprint",
        title: "Intelligent Sample Data",
        type: "major",
        changes: [
            "Multi-Size Bubble Selector.",
            "Administrative Size Management.",
            "Massive refactor of Sample Data Model."
        ]
    },
    {
        version: "Session 9",
        date: "UI Sprint",
        title: "Scheduling Refactor",
        type: "major",
        changes: [
            "Job Appointments Table (Multi-day jobs).",
            "Dashboard Carousels (Active Pipeline).",
            "Installer Search."
        ]
    },
    {
        version: "Session 8",
        date: "Security Sprint",
        title: "RBAC & Auditing",
        type: "major",
        changes: [
            "Role-Based Access Control (Admin vs User).",
            "User Management UI.",
            "Full-Stack Auditing System.",
            "Customer Creation validation overhaul."
        ]
    },
    {
        version: "Session 7",
        date: "Stability Sprint",
        title: "Full-Stack Stabilization",
        type: "fix",
        changes: [
            "Fixed Quote Acceptance workflow.",
            "Solved 'Reload Loop' (Caddy/Vite websocket fix).",
            "Unified 'On-the-Fly' creation UI."
        ]
    },
    {
        version: "Session 6",
        date: "Auth Sprint",
        title: "Authentication",
        type: "infrastructure",
        changes: [
            "Implemented SuperTokens for secure login.",
            "Transitioned from single-user to multi-user architecture."
        ]
    },
    {
        version: "Session 5",
        date: "Feature Sprint",
        title: "Vendor Management",
        type: "major",
        changes: [
            "Dedicated Vendor Directory.",
            "Intelligent Autofill for Orders.",
            "Deep integration with Products and Samples."
        ]
    },
    {
        version: "Session 4",
        date: "Ops Sprint",
        title: "Backup & Restore",
        type: "feature",
        changes: [
            "Full Database Backup/Restore tools.",
            "Image Archive handling.",
            "Extend Checkout functionality."
        ]
    },
    {
        version: "Session 3",
        date: "Foundational",
        title: "Core Architecture",
        type: "major",
        changes: [
            "Full-Stack Refactor (Service Layer).",
            "Quick Checkout & QR Code System.",
            "Installation Types logic.",
            "Mobile Responsiveness."
        ]
    }
];