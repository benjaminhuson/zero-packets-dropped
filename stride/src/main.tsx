import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { VersionFooter } from './components/VersionFooter';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <VersionFooter />
  </StrictMode>,
);
