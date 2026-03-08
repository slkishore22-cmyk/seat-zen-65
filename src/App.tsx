import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopNav from "@/components/TopNav";
import RequireUserSession from "@/components/RequireUserSession";
import Index from "./pages/Index";
import SavedRoomsPage from "./pages/SavedRoomsPage";
import LoginPage from "./pages/LoginPage";
import MasterAdminPage from "./pages/MasterAdminPage";
import NotFound from "./pages/NotFound";
import { ExamSessionProvider } from "@/hooks/useExamSession";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => (
  <RequireUserSession>
    <TopNav />
    {children}
  </RequireUserSession>
);

const App = () => (
  <>
    <Sonner />
    <BrowserRouter>
      <ExamSessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/master" element={<MasterAdminPage />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute><SavedRoomsPage /></ProtectedRoute>} />
          <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
        </Routes>
      </ExamSessionProvider>
    </BrowserRouter>
  </>
);

export default App;
