import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './App.css'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>,
)
