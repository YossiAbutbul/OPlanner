import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './css/index.css'
import App from './App.tsx'

import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css';
import { HomeworkProvider } from './context/HomeworkContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HomeworkProvider>
      <App />
    </HomeworkProvider>
  </React.StrictMode>
);