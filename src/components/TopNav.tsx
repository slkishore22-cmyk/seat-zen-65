import { LayoutGrid, Archive, LogOut, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";

const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isWizard = location.pathname === "/";
  const isSaved = location.pathname === "/saved";

  const session = useMemo(() => {
    try {
      const raw = localStorage.getItem("seat_user_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("seat_user_session");
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card" style={{ borderRadius: 0, borderTop: "none", borderLeft: "none", borderRight: "none" }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="text-base font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
          Exam Seating
        </span>

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

        <div className="flex items-center gap-3">
          {session && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User size={14} />
              {session.full_name || session.username}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
