import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';

import './index.css';

import { enableMapSet } from 'immer';

enableMapSet(); // Initialize immer so it can use Map and Set

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
