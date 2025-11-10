import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// --- Import Routers ---
import customerRoutes from './routes/customers.js';
import sampleRoutes from './routes/samples.js';
import sampleCheckoutRoutes from './routes/sampleCheckouts.js';
import projectRoutes from './routes/projects.js';
import installerRoutes from './routes/installers.js';
import quoteRoutes from './routes/quotes.js';
import jobRoutes from './routes/jobs.js';
import changeOrderRoutes from './routes/change-orders.js';
import photoRoutes from './routes/photos.js';
import orderRoutes from './routes/orders.js';
import searchRoutes from './routes/search.js';
import calendarRoutes from './routes/calendar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const app = express();
const PORT = 3001;

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// --- MIDDLEWARE ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- API ENDPOINTS ---
app.get('/api', (req, res) => res.json({ message: 'Backend is running!' }));

// --- Use Routers ---
app.use('/api/customers', customerRoutes);
app.use('/api/samples', sampleRoutes);
app.use('/api/sample-checkouts', sampleCheckoutRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/installers', installerRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/change-orders', changeOrderRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/calendar', calendarRoutes);

// --- START THE SERVER ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});