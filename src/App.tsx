import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopNav from "@/components/TopNav";
import Index from "./pages/Index";
import SavedRoomsPage from "./pages/SavedRoomsPage";
import LoginPage from "./pages/LoginPage";
import MasterAdminPage from "./pages/MasterAdminPage";
import NotFound from "./pages/NotFound";
import { ExamSessionProvider } from "@/hooks/useExamSession";

const App = () => (
  <>
    <Sonner />
    <BrowserRouter>
      <ExamSessionProvider>
        <TopNav />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/saved" element={<SavedRoomsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/master" element={<MasterAdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ExamSessionProvider>
    </BrowserRouter>
  </>
);

export default App;
