import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- DYNAMIC DOMAIN CONFIGURATION ---
// Reads from .env (VITE_APP_DOMAIN) or defaults to Localhost for Dev
const appDomain = import.meta.env.VITE_APP_DOMAIN || 'http://localhost:5173';

SuperTokens.init({
  appInfo: {
    appName: "Joblogger",
    apiDomain: appDomain,
    websiteDomain: appDomain,
    apiBasePath: "/api/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init({
      disableSignUp: true, 
    }),   
    Session.init(),
  ],
});

// --- REACT QUERY CLIENT ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes (prevents immediate re-fetching)
      staleTime: 1000 * 60 * 5, 
      // Retry failed requests once before throwing error
      retry: 1,
      // Refetch when window regains focus (great for "multi-tab" users)
      refetchOnWindowFocus: true, 
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuperTokensWrapper>
        <App />
      </SuperTokensWrapper>
    </QueryClientProvider>
    <Toaster position="bottom-right" /> 
  </React.StrictMode>
);