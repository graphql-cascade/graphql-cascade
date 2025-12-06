import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'urql';
import { client } from './urql-client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider value={client}>
      <App />
    </Provider>
  </React.StrictMode>,
);