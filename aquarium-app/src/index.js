import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { env } from '@xenova/transformers';

// 🌍 GLOBAL CONFIGURATION FOR AI MODEL 🌍
// Disable local model checks to prevent "Unexpected token <" errors
env.allowLocalModels = false;
env.useBrowserCache = false; // Disable cache temporarily to force reload
console.log('[Global] Transformers env configured:', env);


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
