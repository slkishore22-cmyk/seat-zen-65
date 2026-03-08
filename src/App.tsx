import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import TopNav from "@/components/TopNav";
import Index from "./pages/Index";
import SavedRoomsPage from "./pages/SavedRoomsPage";
import LoginPage from "./pages/LoginPage";
import MasterAdminPage from "./pages/MasterAdminPage";
import NotFound from "./pages/NotFound";
import { ExamSessionProvider } from "@/hooks/useExamSession";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = localStorage.getItem("seat_user_session");
  const location = useLocation();
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

const App = () => (
  <>
    <Sonner />
    <BrowserRouter>
      <ExamSessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/master" element={<MasterAdminPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <TopNav />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/saved" element={<SavedRoomsPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RequireAuth>
            }
          />
        </Routes>
      </ExamSessionProvider>
    </BrowserRouter>
  </>
);

export default App;
