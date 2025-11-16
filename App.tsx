import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// --- SuperTokens Imports ---
import { SessionAuth } from 'supertokens-auth-react/recipe/session';
import { getSuperTokensRoutesForReactRouterDom } from 'supertokens-auth-react/ui';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui';
import * as reactRouterDom from "react-router-dom";

// --- Our App Imports ---
import { DataProvider } from './context/DataContext';
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

function App() {
  return (
    <DataProvider>
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