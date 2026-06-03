import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import "./App.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <SidebarProvider>
      <BrowserRouter>
        <AuthProvider>
          <DndProvider backend={HTML5Backend}>
            <App />
          </DndProvider>
        </AuthProvider>
      </BrowserRouter>
    </SidebarProvider>
  </ThemeProvider>,
);