import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useExamSession } from "@/hooks/useExamSession";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, Trash2, LayoutGrid, ArrowLeft, X, DoorOpen } from "lucide-react";
import Step5AllRooms from "@/components/Step5AllRooms";
import { toast } from "sonner";

interface SavedExam {
  id: string;
  exam_name: string;
  created_at: string;
  total_students: number;
  shuffle_type: string;
  rooms: any;
  groups: any;
}

const SavedRoomsPage = () => {
  const navigate = useNavigate();
  const { setRoomResults, setActiveRoomTab, restoreSession } = useExamSession();
  const [sessions, setSessions] = useState<SavedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<SavedExam | null>(null);

  const userSession = (() => {
    try { return JSON.parse(localStorage.getItem("user_session") || ""); } catch { return null; }
  })();

  const fetchSessions = async () => {
    if (!userSession?.id) return;
    const { data } = await supabase
      .from("exam_sessions")
      .select("*")
      .eq("user_id", userSession.id)
      .order("created_at", { ascending: false });
    setSessions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleView = (s: SavedExam) => {
    restoreSession({
      roomResults: s.rooms,
      allGroups: s.groups,
      shuffleType: (s.shuffle_type as any) || "normal",
      currentSessionId: s.id,
    });
    setActiveRoomTab(0);
    setViewingSession(s);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("exam_sessions").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setSessions(prev => prev.filter(s => s.id !== id));
    setConfirmId(null);
    toast.success("Session deleted.");
  };

  return (
    <main className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to New Exam
      </button>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Saved Exams</h1>
        <p className="text-muted-foreground text-base">View and manage your saved exam sessions</p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground text-sm py-20">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <div className="float-animation inline-block mb-6">
            <LayoutGrid size={48} strokeWidth={1} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-6">No saved sessions yet. Create your first exam arrangement.</p>
          <button className="btn-primary" onClick={() => navigate("/")}>Create an Exam</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map(s => (
            <div
              key={s.id}
              className="glass-card p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] relative group"
              onClick={() => handleView(s)}
            >
              <h3 className="text-base font-semibold mb-3 truncate">{s.exam_name || "Untitled Exam"}</h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} strokeWidth={1.5} />
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1.5">
                  <DoorOpen size={12} strokeWidth={1.5} />
                  {Array.isArray(s.rooms) ? s.rooms.length : 0} rooms
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={12} strokeWidth={1.5} />
                  {s.total_students} students · {s.shuffle_type}
                </div>
              </div>

              <button
                onClick={e => { e.stopPropagation(); setConfirmId(s.id); }}
                className="absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>

              {confirmId === s.id && (
                <div
                  className="absolute inset-0 glass-card flex items-center justify-center gap-3"
                  style={{ borderRadius: 18 }}
                  onClick={e => e.stopPropagation()}
                >
                  <span className="text-sm font-medium">Delete?</span>
                  <button className="btn-primary text-xs px-4 py-1.5" style={{ backgroundColor: "hsl(var(--destructive))" }} onClick={() => handleDelete(s.id)}>Yes</button>
                  <button className="btn-secondary text-xs px-4 py-1.5" onClick={() => setConfirmId(null)}>No</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewingSession && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto"
          onClick={() => setViewingSession(null)}
        >
          <div
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-6xl mx-4 my-8 p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setViewingSession(null)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
            <Step5AllRooms onNewExam={() => { setViewingSession(null); navigate("/"); }} readOnly />
          </div>
        </div>
      )}
    </main>
  );
};

export default SavedRoomsPage;
