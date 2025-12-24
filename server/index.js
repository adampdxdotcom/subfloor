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
import { initDatabase } from './lib/dbInit.js';
import { loadSystemConfig, getSystemConfig } from './lib/setupService.js';

// --- ROUTE IMPORTS ---
import customerRoutes from './routes/customers.js';
import productRoutes from './routes/products.js';
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
import reportGeneratorRoutes from './routes/reportGenerator.js';
import reminderRoutes from './routes/reminders.js';
import importRoutes from './routes/import.js';
import notificationRoutes from './routes/notifications.js';
import jobNotesRoutes from './routes/jobNotes.js'; 
import messageRoutes from './routes/messages.js';
import setupRoutes from './routes/setup.js';
import kbRoutes from './routes/kb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- BOOTSTRAP: DB & CONFIG ---
await initDatabase();
await loadSystemConfig();

const sysConfig = getSystemConfig();

const APP_DOMAIN = sysConfig.publicUrl || process.env.APP_DOMAIN || "http://localhost:3001";
const API_DOMAIN = sysConfig.publicUrl || process.env.API_DOMAIN || "http://localhost:3001";

const getCookieDomain = (urlStr) => {
    try {
        const hostname = new URL(urlStr).hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
        const parts = hostname.split('.');
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
                        signUpPOST: async function (input) {
                            const config = getSystemConfig();
                            if (config.isInitialized) {
                                return {
                                    status: "GENERAL_ERROR",
                                    message: "Setup is complete. New user registration is disabled."
                                };
                            }
                            return await originalImplementation.signUpPOST(input);
                        }
                    };
                }
            }
        }),
        Session.init({
            // --- DYNAMIC COOKIE CONFIG ---
            // cookieDomain: getCookieDomain(APP_DOMAIN), // Disabled to allow localhost sharing
        
            cookieSecure: true, 
            cookieSameSite: "none",
            olderCookieDomain: ".dumbleigh.com" 
        })
    ]
});

const app = express();
app.set('trust proxy', true); 

// --- DIAGNOSTIC LOGGER ---
app.use((req, res, next) => {
    console.log(`👉 INCOMING: ${req.method} ${req.url}`);
    console.log(`   Host: ${req.headers['host']}`);
    console.log(`   Origin: ${req.headers['origin']}`);
    next();
});

const PORT = 3001;

initializeEmailService();
initializeScheduler();

const uploadsDir = process.env.NODE_ENV === 'production' 
    ? '/app/server/uploads' 
    : path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
const brandingDir = path.join(uploadsDir, 'branding');
if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir);

const exposedHeaders = new Set([
    'front-token', 
    ...supertokens.getAllCORSHeaders()
]);

app.use(cors({
    origin: (origin, callback) => {
        try {
            const config = getSystemConfig();

            // 1. SETUP MODE: Allow Everything
            if (!config.isInitialized) {
                return callback(null, true);
            }

            // 2. LOCKED MODE: Strict Check
            const runtimeUrl = config.publicUrl || APP_DOMAIN;
            
            const allowed = [
                runtimeUrl, 
                ...(config.allowedDomains || [])
            ];

            if (process.env.ALLOWED_DOMAINS) {
                allowed.push(...process.env.ALLOWED_DOMAINS.split(",").map(d => d.trim()));
            }

            // Mobile Origins
            allowed.push(
                'http://localhost', 
                'https://localhost', 
                'capacitor://localhost',
                'http://localhost:3000',
                'http://localhost:5173'
            );

            const normalize = (url) => url ? url.replace(/\/$/, '') : '';
            const incoming = normalize(origin);
            const allowedNormalized = allowed.map(normalize);

            if (!origin || allowedNormalized.includes(incoming)) {
                callback(null, true);
            } else {
                console.error(`❌ CORS BLOCKED: Origin '${origin}'`);
                console.error(`   Allowed List:`, allowedNormalized);
                callback(new Error('Not allowed by CORS'));
            }
        } catch (err) {
            console.error("🔥 CRASH INSIDE CORS CONFIG:", err);
            callback(new Error("Internal CORS Configuration Error"));
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
app.use('/uploads', express.static(uploadsDir));

// --- NEW DEBUGGER FOR AUTH ---
app.use('/api/auth', (req, res, next) => {
    console.log("🔍 AUTH TRAP: Request hit /api/auth");
    console.log(`   Method: ${req.method}`);
    console.log(`   URL: ${req.originalUrl}`);
    next();
});

// WRAP SUPERTOKENS MIDDLEWARE
const superTokensMiddleware = middleware();
app.use(async (req, res, next) => {
    try {
        await superTokensMiddleware(req, res, next);
    } catch (err) {
        console.error("🔥 SUPERTOKENS MIDDLEWARE ERROR:", err);
        next(err);
    }
});

// --- API ENDPOINTS ---
app.get('/api', (req, res) => res.json({ message: 'Backend is running!' }));
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
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
app.use('/api/reports', reportRoutes);
app.use('/api/report-generator', reportGeneratorRoutes);
app.use('/api/import', importRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/jobs', jobNotesRoutes); 
app.use('/api/messages', messageRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/kb', kbRoutes);

// --- SERVE FRONTEND ---
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    console.log('📂 Serving static frontend from ./public');
    app.use(express.static(publicPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return next();
        }
        res.sendFile(path.join(publicPath, 'index.html'));
    });
}

// --- ERROR HANDLING ---
app.use(errorHandler());

// --- CATCH-ALL ERROR LOGGER ---
app.use((err, req, res, next) => {
    console.error("🔥 FATAL SERVER ERROR:", err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: "Internal Server Error", message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);  
});