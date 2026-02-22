import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSavedRooms } from "@/hooks/useSavedRooms";
import { RoomData } from "@/pages/Index";
import { Calendar, Columns, Users, Trash2, LayoutGrid, ArrowLeft, X } from "lucide-react";
import Step4RoomTable from "@/components/Step4RoomTable";

const SavedRoomsPage = () => {
  const navigate = useNavigate();
  const { rooms, deleteRoom } = useSavedRooms();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [viewingRoom, setViewingRoom] = useState<RoomData | null>(null);

  return (
    <main className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      {/* Back link */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to New Room
      </button>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Saved Rooms</h1>
        <p className="text-muted-foreground text-base">View and manage your saved arrangements</p>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-20">
          <div className="float-animation inline-block mb-6">
            <LayoutGrid size={48} strokeWidth={1} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-6">No rooms saved yet. Create your first room above.</p>
          <button className="btn-primary" onClick={() => navigate("/")}>Create a Room</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map(room => (
            <div
              key={room.id}
              className="glass-card p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] relative group"
              onClick={() => setViewingRoom(room)}
            >
              <h3 className="text-base font-semibold mb-3 truncate">{room.name}</h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} strokeWidth={1.5} />
                  {new Date(room.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={12} strokeWidth={1.5} />
                  {room.seatMap.filter(s => s.rollNumber).length} students
                </div>
                <div className="flex items-center gap-1.5">
                  <Columns size={12} strokeWidth={1.5} />
                  {room.layout.columns.length} columns · {room.shuffleType}
                </div>
              </div>

              <button
                onClick={e => { e.stopPropagation(); setConfirmId(room.id); }}
                className="absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>

              {confirmId === room.id && (
                <div
                  className="absolute inset-0 glass-card flex items-center justify-center gap-3"
                  style={{ borderRadius: 18 }}
                  onClick={e => e.stopPropagation()}
                >
                  <span className="text-sm font-medium">Delete?</span>
                  <button className="btn-primary text-xs px-4 py-1.5" style={{ backgroundColor: "hsl(var(--destructive))" }} onClick={() => { deleteRoom(room.id); setConfirmId(null); }}>Yes</button>
                  <button className="btn-secondary text-xs px-4 py-1.5" onClick={() => setConfirmId(null)}>No</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal overlay for viewing a saved room */}
      {viewingRoom && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto"
          onClick={() => setViewingRoom(null)}
        >
          <div
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-6xl mx-4 my-8 p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setViewingRoom(null)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
            <Step4RoomTable
              layout={viewingRoom.layout}
              groups={viewingRoom.groups}
              seatMap={viewingRoom.seatMap}
              setSeatMap={() => {}}
              overflow={[]}
              conflictCount={0}
              setConflictCount={() => {}}
              setOverflow={() => {}}
              shuffleType={viewingRoom.shuffleType}
              onNewRoom={() => { setViewingRoom(null); navigate("/"); }}
              onSave={() => {}}
              readOnly={true}
            />
          </div>
        </div>
      )}
    </main>
  );
};

export default SavedRoomsPage;
