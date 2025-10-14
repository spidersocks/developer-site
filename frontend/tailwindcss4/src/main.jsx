import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import './aws/amplifyConfig'; // 👈 add this line

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);