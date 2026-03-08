import { useState, useEffect } from "react";
import { LayoutGrid, Archive, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useExamSession } from "@/hooks/useExamSession";

const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetSession } = useExamSession();
  const isWizard = location.pathname === "/";
  const isSaved = location.pathname === "/saved";
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  const session = (() => {
    try { return JSON.parse(localStorage.getItem("user_session") || ""); } catch { return null; }
  })();

  useEffect(() => {
    if (!session?.id) return;
    supabase
      .from("exam_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.id)
      .then(({ count }) => setSessionCount(count ?? 0));
  }, [session?.id, location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("user_session");
    resetSession();
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card" style={{ borderRadius: 0, borderTop: "none", borderLeft: "none", borderRight: "none" }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="text-base font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
          Exam Seating
        </span>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-pill bg-secondary">
            <button
              onClick={() => navigate("/")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-pill text-sm font-medium transition-all duration-200 ${
                isWizard
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={14} strokeWidth={1.5} />
              New Exam
            </button>
            <button
              onClick={() => navigate("/saved")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-pill text-sm font-medium transition-all duration-200 ${
                isSaved
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Archive size={14} strokeWidth={1.5} />
              Saved
            </button>
          </div>

          {session && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {session.full_name}
                {sessionCount !== null && (
                  <span className="text-muted-foreground font-normal ml-1.5">· {sessionCount} saved</span>
                )}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
