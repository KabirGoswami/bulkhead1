import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { SessionProvider, ApplicationProvider, useSession } from './lib/session';
import './index.css'
import './styles/application.css'

function HouseholdApplication() {
  const { user, home } = useSession();
  return <ApplicationProvider key={`${user?.id || 'anonymous'}:${home?.id || 'none'}`}><App /></ApplicationProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider><HouseholdApplication /></SessionProvider>
  </React.StrictMode>,
)
