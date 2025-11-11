import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
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
import VendorList from './pages/VendorList'; // --- NEW ---
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <DataProvider>
      <Toaster 
        position="top-center" 
        reverseOrder={false}
        containerStyle={{
          zIndex: 9999,
        }}
      />
      
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:customerId" element={<CustomerDetail />} />
            <Route path="projects/:projectId" element={<ProjectDetail />} />
            <Route path="samples" element={<SampleLibrary />} />
            <Route path="vendors" element={<VendorList />} />
            <Route path="installers" element={<InstallerList />} />
            <Route path="installers/:installerId" element={<InstallerDetail />} />
            <Route path="quotes/:quoteId" element={<QuoteDetail />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </DataProvider>
  );
}

export default App;