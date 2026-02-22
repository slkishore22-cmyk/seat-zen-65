import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopNav from "@/components/TopNav";
import Index from "./pages/Index";
import SavedRoomsPage from "./pages/SavedRoomsPage";
import NotFound from "./pages/NotFound";
import { SavedRoomsProvider } from "@/hooks/useSavedRooms";

const App = () => (
  <>
    <Sonner />
    <BrowserRouter>
      <SavedRoomsProvider>
        <TopNav />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/saved" element={<SavedRoomsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SavedRoomsProvider>
    </BrowserRouter>
  </>
);

export default App;
