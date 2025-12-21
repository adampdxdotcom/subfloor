import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getBaseUrl } from './utils/apiConfig';

// --- DEBUG LOG ---
console.log("✅ SuperTokens Config Loaded");

// --- DYNAMIC DOMAIN CONFIGURATION ---
// 1. If on Mobile (getBaseUrl returns a value), use that remote server.
// 2. If on Web (getBaseUrl returns empty), use the current browser origin.
const dynamicApiDomain = getBaseUrl() || window.location.origin;

console.log("🔗 SuperTokens Connecting to:", dynamicApiDomain);

SuperTokens.init({
  appInfo: {
    appName: "Subfloor",
    apiDomain: dynamicApiDomain,
    websiteDomain: dynamicApiDomain,
    apiBasePath: "/api/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init({
      useShadowDom: false, // CRITICAL: Allows global CSS variables to work
      disableSignUp: true, 
      
      // --- STYLE OVERRIDES ---
      style: {
        container: {
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", // shadow-lg
            borderRadius: "0.5rem", // rounded-lg
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
            display: "none" // Optional: Hides "Powered by SuperTokens"
        }
      }
    }),   
    Session.init(),
  ],
  languageTranslations: {
    translations: {
      en: {
        "EMAIL_PASSWORD_SIGN_IN_HEADER_TITLE": "Welcome Back",
        "EMAIL_PASSWORD_SIGN_IN_HEADER_SUBTITLE_START": "Log in to your account",
        // These hide the "Sign Up" text if disableSignUp doesn't catch it
        "EMAIL_PASSWORD_SIGN_IN_HEADER_SUBTITLE_SIGN_UP_LINK": "", 
        "EMAIL_PASSWORD_SIGN_UP_FOOTER_START": "", 
        "EMAIL_PASSWORD_SIGN_UP_FOOTER_SIGN_IN_LINK": ""
      },
    },
  },
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