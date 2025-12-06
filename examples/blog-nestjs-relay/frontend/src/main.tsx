import React from 'react'
import ReactDOM from 'react-dom/client'
import { RelayEnvironmentProvider } from 'react-relay'
import RelayEnvironment from './relay/environment'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <App />
    </RelayEnvironmentProvider>
  </React.StrictMode>,
)