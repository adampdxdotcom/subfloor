import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import { Toaster } from 'react-hot-toast';

// --- DYNAMIC DOMAIN CONFIGURATION ---
// Reads from .env (VITE_APP_DOMAIN) or defaults to Localhost for Dev
const appDomain = import.meta.env.VITE_APP_DOMAIN || 'http://localhost:5173';

SuperTokens.init({
  appInfo: {
    appName: "Joblogger",
    // Since we use a Proxy in Dev and a Monolith in Prod, 
    // the API and Website share the same domain/port!
    apiDomain: appDomain,
    websiteDomain: appDomain,
    apiBasePath: "/api/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init({
      disableSignUp: true, // You might want to make this dynamic later too!
    }),   
    Session.init(),
  ],
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SuperTokensWrapper>
      <App />
    </SuperTokensWrapper>
    <Toaster position="bottom-right" /> 
  </React.StrictMode>
);