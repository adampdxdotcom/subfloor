import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// --- SuperTokens Imports ---
import { SessionAuth } from 'supertokens-auth-react/recipe/session';
import { getSuperTokensRoutesForReactRouterDom } from 'supertokens-auth-react/ui';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui';
import * as reactRouterDom from "react-router-dom";

// --- Our App Imports ---
import { DataProvider, useData } from './context/DataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import { VersionManager } from './components/VersionManager';
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
import VendorDetail from './pages/VendorDetail'; 
import OrderDashboard from './pages/OrderDashboard';
import Reports from './pages/Reports';
import ImportData from './pages/ImportData'; 
import Messages from './pages/Messages'; 
import SetupWizard from './pages/SetupWizard'; 
import KnowledgeBase from './pages/KnowledgeBase'; 
import ServerConnect from './pages/ServerConnect'; 
import { getEndpoint, getBaseUrl, getImageUrl } from './utils/apiConfig'; 
import { Loader2 } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';


// --- NEW COMPONENT: HANDLES ANDROID BACK BUTTON ---
const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only run if we are in a Native context
    const isNative = (window as any).Capacitor?.isNativePlatform();
    if (!isNative) return;

    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // 1. Try to close any open modal first
      const modalClose = document.querySelector('[aria-label="Close modal"]') as HTMLElement;
      if (modalClose && modalClose.offsetParent !== null) {
          modalClose.click();
          return;
      }

      // 2. Try to close the Sidebar overlay
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebarOverlay) {
          sidebarOverlay.click();
          return;
      }

      // 3. If at Root (Dashboard or Login), Exit App
      if (location.pathname === '/' || location.pathname === '/auth') {
        CapacitorApp.exitApp();
      } 
      // 4. Otherwise, Go Back in History
      else {
        navigate(-1);
      }
    });

    return () => {
      listener.then(handler => handler.remove());
    };
  }, [navigate, location]);

  return null;
};

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
      link.href = getImageUrl(systemBranding.faviconUrl);
          
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    
    // 1.5 Handle Page Title
    if (systemBranding?.companyName) {
        document.title = `Subfloor for ${systemBranding.companyName}`;
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
    if (systemBranding?.surfaceColor) {
       root.style.setProperty('--color-border', darkenColor(systemBranding.surfaceColor, -10)); 
    }
    
  }, [systemBranding]);

  return null;
};

function App() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState(false); // NEW: Track connection failures

  // Robust check: Only true if running inside the actual Android/iOS app
  const isNative = (window as any).Capacitor?.isNativePlatform();
  const hasServerUrl = !!localStorage.getItem('subfloor_server_url');

  useEffect(() => {
    // 1. If native app and no URL, skip fetch (Connect Screen will render)
    if (isNative && !hasServerUrl) {
        setIsInitialized(null); 
        return;
    }

    fetch(getEndpoint('/api/setup/status'))
      .then(res => res.json())
      .then(data => setIsInitialized(data.initialized))
      .catch(err => {
        console.error("Failed to check setup status", err);
        
        // 2. IF MOBILE and Fetch Fails -> It means URL is wrong or Server is down.
        // Show Connect Screen so user can Reset/Change URL.
        if (isNative) {
            setConnectionError(true);
        } else {
            // On Web, fall back to normal behavior
            setIsInitialized(true);
        }
      });
  }, [isNative, hasServerUrl]);

  // RENDER LOGIC:
  // Show Connect Screen if:
  // A. First time launch (no URL)
  // B. Connection failed (URL might be wrong)
  if (isNative && (!hasServerUrl || connectionError)) {
      return <ServerConnect />;
  }

  if (isInitialized === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (isInitialized === false) return <SetupWizard />;

  return (
    <DataProvider>
      <VersionManager />
      <BrandingListener />
      <Router>
        <BackButtonHandler />
        <Routes>
          {getSuperTokensRoutesForReactRouterDom(reactRouterDom, [EmailPasswordPreBuiltUI])}

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
            <Route path="reports" element={<Reports />} />
            <Route path="import" element={<ImportData />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:partnerId" element={<Messages />} />
            <Route path="kb" element={<KnowledgeBase />} />
            <Route path="vendors" element={<VendorList />} />
            <Route path="vendors/:vendorId" element={<VendorDetail />} />
            <Route path="orders" element={<OrderDashboard />} />
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