import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// --- SuperTokens Imports ---
import { SessionAuth } from 'supertokens-auth-react/recipe/session';
import { getSuperTokensRoutesForReactRouterDom } from 'supertokens-auth-react/ui';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui';
import * as reactRouterDom from "react-router-dom";

// --- Our App Imports ---
import { DataProvider, useData } from './context/DataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import CustomerDetail from './pages/CustomerDetail';
import ProjectDetail from './pages/ProjectDetail';
import CalendarView from './pages/CalendarView';
import SampleLibrary from './pages/SampleLibrary';
import InstallerList from './pages/InstallerList';
import InstallerDetail from './pages/InstallerDetail';
import QuoteDetail from './pages/QuoteDetail';
import Settings from './pages/Settings';
import VendorList from './pages/VendorList';
import VendorDetail from './pages/VendorDetail'; // <-- 1. ADD THIS IMPORT

const API_URL = "https://flooring.dumbleigh.com";

// Helper to darken a hex color for hover states
const darkenColor = (hex: string, percent: number) => {
    let num = parseInt(hex.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) - amt,
        G = (num >> 8 & 0x00FF) - amt,
        B = (num & 0x0000FF) - amt;
        
    return "#" + (
        0x1000000 
        + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 
        + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 
        + (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
};

// NEW: Helper to calculate best text color (Black or White) based on background contrast
const getContrastText = (hex: string) => {
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    
    // YIQ equation from 24 Ways
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // If YIQ >= 128, it's a light color (use black text), otherwise dark (use white text)
    return yiq >= 128 ? '#000000' : '#ffffff';
};

const BrandingListener = () => {
  const { systemBranding } = useData();

  React.useEffect(() => {
    // 1. Handle Favicon
    if (systemBranding?.faviconUrl) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'icon';
      link.href = `${API_URL}${systemBranding.faviconUrl}`;
      document.getElementsByTagName('head')[0].appendChild(link);
    }

    // 2. Handle Colors
    const root = document.documentElement;
    if (systemBranding?.primaryColor) {
      root.style.setProperty('--color-primary', systemBranding.primaryColor);
      root.style.setProperty('--color-primary-hover', darkenColor(systemBranding.primaryColor, 10));
      root.style.setProperty('--color-on-primary', getContrastText(systemBranding.primaryColor));
    }
    if (systemBranding?.secondaryColor) {
      root.style.setProperty('--color-secondary', systemBranding.secondaryColor);
      root.style.setProperty('--color-secondary-hover', darkenColor(systemBranding.secondaryColor, 10));
      root.style.setProperty('--color-on-secondary', getContrastText(systemBranding.secondaryColor));
    }
    if (systemBranding?.accentColor) {
      root.style.setProperty('--color-accent', systemBranding.accentColor);
      root.style.setProperty('--color-accent-hover', darkenColor(systemBranding.accentColor, 10));
      root.style.setProperty('--color-on-accent', getContrastText(systemBranding.accentColor));
    }
    
    // 3. Handle Base Theme (Optional, checks if they exist)
    if (systemBranding?.backgroundColor) {
        root.style.setProperty('--color-background', systemBranding.backgroundColor);
    }
    if (systemBranding?.surfaceColor) {
        root.style.setProperty('--color-surface', systemBranding.surfaceColor);
    }
    if (systemBranding?.textPrimaryColor) {
        root.style.setProperty('--color-text-primary', systemBranding.textPrimaryColor);
    }
    if (systemBranding?.textSecondaryColor) {
        root.style.setProperty('--color-text-secondary', systemBranding.textSecondaryColor);
    }
    // We'll auto-calculate border from surface if needed, or just leave default for now
    if (systemBranding?.surfaceColor) {
       // Simple hack: make border slightly lighter than surface for dark mode consistency
       root.style.setProperty('--color-border', darkenColor(systemBranding.surfaceColor, -10)); 
    }
    
  }, [systemBranding]);

  return null;
};

function App() {
  return (
    <DataProvider>
      <BrandingListener />
      <Router>
        <Routes>
          {/* This renders the auth UI routes like /auth, /auth/forgot-password, etc */}
          {getSuperTokensRoutesForReactRouterDom(reactRouterDom, [EmailPasswordPreBuiltUI])}

          {/* This is our protected route. */}
          <Route
            path="/"
            element={
              <SessionAuth>
                <Layout />
              </SessionAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:customerId" element={<CustomerDetail />} />
            <Route path="projects/:projectId" element={<ProjectDetail />} />
            <Route path="samples" element={<SampleLibrary />} />
            <Route path="vendors" element={<VendorList />} />
            {/* --- 2. ADD THIS NEW NESTED ROUTE --- */}
            <Route path="vendors/:vendorId" element={<VendorDetail />} />
            <Route path="installers" element={<InstallerList />} />
            <Route path="installers/:installerId" element={<InstallerDetail />} />
            <Route path="quotes/:quoteId" element={<QuoteDetail />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
    </DataProvider>
  );
}

export default App;