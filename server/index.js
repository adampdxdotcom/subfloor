// server/index.js

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session/index.js';
import EmailPassword from 'supertokens-node/recipe/emailpassword/index.js';
import { middleware, errorHandler } from 'supertokens-node/framework/express/index.js';

// --- SERVICE IMPORTS ---
import { initializeEmailService } from './lib/emailService.js';
import { initializeScheduler } from './lib/scheduler.js';
import { initDatabase } from './lib/dbInit.js'; // NEW IMPORT
import { loadSystemConfig, getSystemConfig } from './lib/setupService.js';

// --- ROUTE IMPORTS ---
import customerRoutes from './routes/customers.js';
import productRoutes from './routes/products.js'; // Replaces samples.js
import sampleCheckoutRoutes from './routes/sampleCheckouts.js';
import projectRoutes from './routes/projects.js';
import installerRoutes from './routes/installers.js';
import quoteRoutes from './routes/quotes.js';
import backupRoutes from './routes/backup.js';
import restoreRoutes from './routes/restore.js';
import jobRoutes from './routes/jobs.js';
import changeOrderRoutes from './routes/change-orders.js';
import photoRoutes from './routes/photos.js';
import orderRoutes from './routes/orders.js';
import searchRoutes from './routes/search.js';
import calendarRoutes from './routes/calendar.js';
import vendorRoutes from './routes/vendors.js';
import userRoutes from './routes/users.js'; 
import roleRoutes from './routes/roles.js';
import preferenceRoutes from './routes/preferences.js';
import eventRoutes from './routes/events.js';
import reportRoutes from './routes/reports.js';
import reportGeneratorRoutes from './routes/reportGenerator.js'; // NEW: Business Reports
import reminderRoutes from './routes/reminders.js';
import importRoutes from './routes/import.js'; // NEW: Import Tool
import notificationRoutes from './routes/notifications.js'; // NEW: Notifications
import jobNotesRoutes from './routes/jobNotes.js'; 
import messageRoutes from './routes/messages.js'; // NEW: Direct Messages
import setupRoutes from './routes/setup.js'; // NEW: Setup Wizard
import kbRoutes from './routes/kb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- BOOTSTRAP: DB & CONFIG ---
// We need to await these before setting up SuperTokens or Express
await initDatabase(); // Ensure tables exist first
await loadSystemConfig(); // Load core_config from DB

const sysConfig = getSystemConfig();

// Logic: If initialized, use stored URL. If not, use Env or default to Localhost for setup.
const APP_DOMAIN = sysConfig.publicUrl || process.env.APP_DOMAIN || "http://localhost:3001";
const API_DOMAIN = sysConfig.publicUrl || process.env.API_DOMAIN || "http://localhost:3001";

// --- HELPER: Extract Cookie Domain ---
// Converts "https://flooring.example.com" -> ".example.com" for cookie sharing
const getCookieDomain = (urlStr) => {
    try {
        const hostname = new URL(urlStr).hostname;
        // Localhost/IPs don't use specific cookie domains
        if (hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
        
        const parts = hostname.split('.');
        // If it's a standard domain (e.g. sub.domain.com), use the last two parts
        if (parts.length >= 2) {
            return `.${parts.slice(-2).join('.')}`;
        }
        return hostname;
    } catch (e) {
        return undefined;
    }
};

// --- INITIALIZE SUPERTOKENS ---
supertokens.init({
    framework: "express",
    supertokens: {
        connectionURI: "http://supertokens:3567",
        apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
        appName: "Subfloor",
        apiDomain: API_DOMAIN,
        websiteDomain: APP_DOMAIN,
        apiBasePath: "/api/auth",
        websiteBasePath: "/auth"
    },
    recipeList: [
        EmailPassword.init({
            override: {
                apis: (originalImplementation) => {
                    return {
                        ...originalImplementation,
                        // INTERCEPT SIGNUPS
                        signUpPOST: async function (input) {
                            const config = getSystemConfig();
                            
                            // If system is already initialized, BLOCK signups
                            if (config.isInitialized) {
                                return {
                                    status: "GENERAL_ERROR",
                                    message: "Setup is complete. New user registration is disabled."
                                };
                            }

                            // If not initialized, allow signup (Setup Wizard creating Admin)
                            // Note: Role assignment happens in the Setup API, not here
                            return await originalImplementation.signUpPOST(input);
                        }
                    };
                }
            }
        }),
        Session.init({
            // --- DYNAMIC COOKIE CONFIG ---
            cookieDomain: getCookieDomain(APP_DOMAIN),
            // FIX: Allow insecure cookies if running on localhost (Mobile App context)
            // If APP_DOMAIN is https, but we are developing or on mobile, we might need flexibility.
            cookieSecure: APP_DOMAIN.startsWith('https') && process.env.NODE_ENV === 'production', 
            cookieSameSite: "lax" 
        })
    ]
});

const app = express();
app.set('trust proxy', true); 

// --- DIAGNOSTIC LOGGER ---
// (Kept for now to ensure connectivity is stable)
//app.use((req, res, next) => {
//    console.log(`👉 INCOMING: ${req.method} ${req.url}`);
//    console.log('   Host:', req.headers['host']);
//    next();
//});
// -------------------------

const PORT = 3001;

// --- INITIALIZE SERVICES ---
initializeEmailService();
initializeScheduler();


// --- MIDDLEWARE & CONFIG ---
// FIX: In production Docker, use explicit absolute path to match the Volume mount.
// In Dev, use relative path.
const uploadsDir = process.env.NODE_ENV === 'production' 
    ? '/app/server/uploads' 
    : path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const brandingDir = path.join(uploadsDir, 'branding');
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir);
}

const exposedHeaders = new Set([
    'front-token', 
    ...supertokens.getAllCORSHeaders()
]);

app.use(cors({
    origin: (origin, callback) => {
        const config = getSystemConfig();

        // 1. SETUP MODE: Allow Everything (or be permissive)
        if (!config.isInitialized) {
            return callback(null, true);
        }

        // 2. LOCKED MODE: Strict Check
        // Calculate allowed list dynamically
        // FIX: Use the live config value (updated by restore) instead of the startup constant
        const runtimeUrl = config.publicUrl || APP_DOMAIN;

        const allowed = [
             runtimeUrl, 
             ...(config.allowedDomains || [])
        ];

        // Also include standard env vars if present (fallback)
        if (process.env.ALLOWED_DOMAINS) {
             allowed.push(...process.env.ALLOWED_DOMAINS.split(",").map(d => d.trim()));
        }

        // Normalize (remove trailing slashes) for comparison
        const normalize = (url) => url ? url.replace(/\/$/, '') : '';
        const incoming = normalize(origin);
        const allowedNormalized = allowed.map(normalize);

        if (!origin || allowedNormalized.includes(incoming)) {
            callback(null, true);
        } else {
            // Log the blockage to help diagnose remote access issues
            console.warn(`⚠️ CORS BLOCKED: Origin '${origin}' is not in the allowed list:`, allowedNormalized);
            console.warn(`   -> Check 'System Settings' > 'Public URL' or add to ALLOWED_DOMAINS env var.`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    exposedHeaders: [...exposedHeaders],
    credentials: true,
}));

app.options('*', (req, res) => {
    res.sendStatus(204);
});

app.use(express.json()); 

// --- DEBUG PATHS ---
console.log("📂 STATIC CONFIG:");
console.log("   -> Serving uploads from:", uploadsDir);
console.log("   -> Directory exists?", fs.existsSync(uploadsDir));
// -------------------

app.use('/uploads', express.static(uploadsDir));
app.use(middleware());   

// --- API ENDPOINTS ---
app.get('/api', (req, res) => res.json({ message: 'Backend is running!' }));
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes); // New Endpoint
app.use('/api/sample-checkouts', sampleCheckoutRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/installers', installerRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/restore', restoreRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/change-orders', changeOrderRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reports', reportRoutes); // Existing Dashboard Reports
app.use('/api/report-generator', reportGeneratorRoutes); // NEW: Business Reports
app.use('/api/report-generator', reportGeneratorRoutes); // NEW: Business Reports
app.use('/api/import', importRoutes); // NEW: Import Tool
app.use('/api/reminders', reminderRoutes);
app.use('/api/notifications', notificationRoutes); // NEW: Notifications
app.use('/api/jobs', jobNotesRoutes); // Mount under /api/jobs to match the :id/notes structure
app.use('/api/messages', messageRoutes); // NEW: Direct Messages
app.use('/api/setup', setupRoutes); // NEW: Setup Wizard
app.use('/api/kb', kbRoutes);

// --- SERVE FRONTEND (DYNAMIC) ---
const publicPath = path.join(__dirname, 'public');

// If the 'public' folder exists (created by Docker build), serve it.
// This makes it work regardless of NODE_ENV setting.
if (fs.existsSync(publicPath)) {
    console.log('📂 Serving static frontend from ./public');
    
    // Serve static files from the React build
    app.use(express.static(publicPath));

    // Handle React Routing, return all requests to React app
    app.get('*', (req, res, next) => {
        // Skip API requests or Uploads to avoid interfering with 404s on the API side
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return next();
        }
        res.sendFile(path.join(publicPath, 'index.html'));
    });
}

// --- ERROR HANDLING ---
app.use(errorHandler());

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);  
});