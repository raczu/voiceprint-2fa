import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { TestRecorder } from "@/pages/test-recoder.tsx";
import { Home } from "@/pages/home.tsx";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const environment = import.meta.env.ENVIRONMENT || import.meta.env.MODE;
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster position="bottom-right" />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          {environment === "development" && (
            <Route path="/test-recorder" element={<TestRecorder />} />
          )}
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
