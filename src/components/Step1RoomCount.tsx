import { useState, useEffect } from "react";
import { ChevronRight, DoorOpen, Clock } from "lucide-react";
import { useExamSession } from "@/hooks/useExamSession";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onNext: () => void;
  onLoadSession?: (session: any) => void;
}

const Step1RoomCount = ({ onNext, onLoadSession }: Props) => {
  const { session, setTotalRooms } = useExamSession();
  const count = session.totalRooms;
  const [showPrevious, setShowPrevious] = useState(false);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const handleChange = (val: number) => {
    const clamped = Math.max(1, Math.min(20, val));
    setTotalRooms(clamped);
  };

  const loadSavedSessions = async () => {
    setLoadingSessions(true);
    const { data } = await supabase
      .from('exam_sessions')
      .select('id, exam_name, created_at, total_students, shuffle_type, rooms, groups')
      .order('created_at', { ascending: false })
      .limit(20);
    setSavedSessions(data || []);
    setLoadingSessions(false);
    setShowPrevious(true);
  };

  const isValid = count >= 1 && count <= 20;

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>How many exam rooms?</h1>
        <p className="text-muted-foreground text-base">Define the total number of rooms for this exam</p>
      </div>

      <div className="flex justify-center mb-10">
        <div className="glass-card p-8 flex flex-col items-center gap-4">
          <label className="text-sm font-medium text-muted-foreground">Number of Rooms</label>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={e => handleChange(parseInt(e.target.value) || 1)}
            className="input-apple w-32 text-center text-2xl font-bold"
          />
          <span className="text-xs text-muted-foreground">Min: 1 · Max: 20</span>
        </div>
      </div>

      {count > 0 && (
        <div className="flex flex-wrap gap-3 justify-center mb-10 max-w-4xl mx-auto">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="glass-card p-4 flex flex-col items-center gap-2 w-28">
              <DoorOpen size={24} strokeWidth={1.5} className="text-muted-foreground" />
              <span className="text-sm font-semibold">Room {i + 1}</span>
              <span className="text-[10px] text-muted-foreground">Not configured yet</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-3">
        <button className="btn-primary" disabled={!isValid} onClick={onNext}>
          Configure Rooms <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
        </button>
        {onLoadSession && (
          <button className="btn-secondary text-sm" onClick={loadSavedSessions}>
            <Clock size={14} strokeWidth={1.5} className="mr-1.5" /> Load Previous
          </button>
        )}
      </div>

      {/* Saved sessions modal */}
      {showPrevious && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPrevious(false)}>
          <div className="glass-card p-6 max-w-md w-full mx-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Previous Sessions</h2>
            {loadingSessions ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            ) : savedSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No saved sessions found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {savedSessions.map(s => (
                  <button
                    key={s.id}
                    className="glass-card p-4 text-left hover:scale-[1.01] transition-transform"
                    onClick={() => { onLoadSession!(s); setShowPrevious(false); }}
                  >
                    <p className="text-sm font-semibold">{s.exam_name || "Untitled Exam"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(s.created_at).toLocaleDateString()} · {s.total_students} students · {s.shuffle_type}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <button className="btn-secondary text-sm w-full mt-4" onClick={() => setShowPrevious(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step1RoomCount;
