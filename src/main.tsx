
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from "@/components/theme-provider";
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider defaultTheme="light" storageKey="flowtech-ui-theme">
      <App />
    </ThemeProvider>
  </BrowserRouter>
);
