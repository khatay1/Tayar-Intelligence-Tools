import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './mobile-native.css';
import './modules';
import { initMonitoring } from './lib/monitoring';
import { initMobileRuntime } from './lib/mobile-runtime';

initMobileRuntime();
initMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
