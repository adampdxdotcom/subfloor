import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import { Toaster } from 'react-hot-toast';

SuperTokens.init({
  appInfo: {
    appName: "Joblogger",
    apiDomain: "https://flooring.dumbleigh.com",
    websiteDomain: "https://flooring.dumbleigh.com",
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