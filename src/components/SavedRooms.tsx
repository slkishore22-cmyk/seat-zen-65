import { RoomData } from "@/pages/Index";
import { Calendar, Columns, Users, Trash2, LayoutGrid } from "lucide-react";
import { useState } from "react";

interface Props {
  rooms: RoomData[];
  onView: (room: RoomData) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const SavedRooms = ({ rooms, onView, onDelete, onNew }: Props) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div>
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
          <button className="btn-primary" onClick={onNew}>Create a Room</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map(room => (
            <div
              key={room.id}
              className="glass-card p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] relative group"
              onClick={() => onView(room)}
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
                  <button className="btn-primary text-xs px-4 py-1.5" style={{ backgroundColor: "hsl(var(--destructive))" }} onClick={() => { onDelete(room.id); setConfirmId(null); }}>Yes</button>
                  <button className="btn-secondary text-xs px-4 py-1.5" onClick={() => setConfirmId(null)}>No</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedRooms;
