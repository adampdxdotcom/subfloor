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

// --- ROUTE IMPORTS ---
import customerRoutes from './routes/customers.js';
import sampleRoutes from './routes/samples.js';
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
import reminderRoutes from './routes/reminders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DYNAMIC DOMAIN CONFIGURATION ---
// If running in Prod Docker without a specific domain set, default to localhost:3001
const APP_DOMAIN = process.env.APP_DOMAIN || "http://localhost:3001";
const API_DOMAIN = process.env.API_DOMAIN || "http://localhost:3001";

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
        apiKey: "some-long-and-secure-key",
    },
    appInfo: {
        appName: "Joblogger",
        apiDomain: API_DOMAIN,
        websiteDomain: APP_DOMAIN,
        apiBasePath: "/api/auth",
        websiteBasePath: "/auth"
    },
    recipeList: [
        EmailPassword.init(),
        Session.init({
            // --- DYNAMIC COOKIE CONFIG ---
            cookieDomain: getCookieDomain(APP_DOMAIN),
            cookieSecure: APP_DOMAIN.startsWith('https'), // Secure only if on HTTPS
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
const uploadsDir = path.join(__dirname, 'uploads');
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
    origin: APP_DOMAIN, // Use the dynamic domain from env
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    exposedHeaders: [...exposedHeaders],
    credentials: true,
}));

app.options('*', (req, res) => {
    res.sendStatus(204);
});

app.use(express.json()); 

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(middleware());   

// --- API ENDPOINTS ---
app.get('/api', (req, res) => res.json({ message: 'Backend is running!' }));
app.use('/api/customers', customerRoutes);
app.use('/api/samples', sampleRoutes);
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
app.use('/api/reminders', reminderRoutes);

// --- SERVE FRONTEND (PRODUCTION ONLY) ---
if (process.env.NODE_ENV === 'production') {
    const publicPath = path.join(__dirname, 'public');
    
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