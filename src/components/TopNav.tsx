import { LayoutGrid, Archive } from "lucide-react";

interface TopNavProps {
  activeTab: "new" | "saved";
  onTabChange: (tab: "new" | "saved") => void;
}

const TopNav = ({ activeTab, onTabChange }: TopNavProps) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card" style={{ borderRadius: 0, borderTop: "none", borderLeft: "none", borderRight: "none" }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="text-base font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
          Exam Seating
        </span>

        <div className="flex items-center gap-1 p-1 rounded-pill bg-secondary">
          <button
            onClick={() => onTabChange("new")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-pill text-sm font-medium transition-all duration-200 ${
              activeTab === "new"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={14} strokeWidth={1.5} />
            New Room
          </button>
          <button
            onClick={() => onTabChange("saved")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-pill text-sm font-medium transition-all duration-200 ${
              activeTab === "saved"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive size={14} strokeWidth={1.5} />
            Saved Rooms
          </button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
