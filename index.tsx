import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getBaseUrl } from './utils/apiConfig';

console.log("✅ SuperTokens Config Loaded");

// --- DYNAMIC DOMAIN CONFIGURATION ---
const apiDomain = getBaseUrl() || window.location.origin;

// The websiteDomain MUST be the local origin (localhost) for Capacitor 
// so that redirects stay inside the app instead of opening the browser.
const websiteDomain = window.location.origin;

console.log("🔗 SuperTokens API:", apiDomain);
console.log("🏠 SuperTokens Website:", websiteDomain);

SuperTokens.init({
  appInfo: {
    appName: "Subfloor",
    apiDomain: apiDomain,
    websiteDomain: websiteDomain,
    apiBasePath: "/api/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init({
      useShadowDom: false,
      disableSignUp: true, 
      style: {
        container: {
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", 
            borderRadius: "0.5rem", 
            fontFamily: "inherit"
        },
        headerTitle: {
            color: "var(--color-text-primary)",
            fontFamily: "inherit"
        },
        label: {
            color: "var(--color-text-secondary)",
        },
        input: {
            backgroundColor: "var(--color-background)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border)",
        },
        button: {
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
            borderRadius: "0.5rem",
            fontWeight: "700",
            border: "none",
            textTransform: "uppercase"
        },
        link: {
            color: "var(--color-accent)"
        },
        superTokensBranding: {
            display: "none"
        }
      }
    }),   
    Session.init(),
  ],
});

// --- REACT QUERY CLIENT ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, 
      retry: 1,
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
  </React.StrictMode>
);