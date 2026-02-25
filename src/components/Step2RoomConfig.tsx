import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { useExamSession } from "@/hooks/useExamSession";
import { ColumnConfig, getTotalCapacity } from "@/lib/shuffleEngine";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const Step2RoomConfig = ({ onNext, onBack }: Props) => {
  const { session, updateRoom } = useExamSession();
  const rooms = session.rooms;
  const [expandedRoom, setExpandedRoom] = useState(0);

  const getRoomStatus = (roomIdx: number): "empty" | "partial" | "complete" => {
    const room = rooms[roomIdx];
    if (!room || room.columns.length === 0) return "empty";
    const allValid = room.columns.every(c => c.rows >= 1 && c.subColumns >= 1 && c.subColumns <= 6);
    return allValid ? "complete" : "partial";
  };

  const getRoomCapacity = (roomIdx: number): number => {
    const room = rooms[roomIdx];
    if (!room || room.columns.length === 0) return 0;
    return getTotalCapacity({ columns: room.columns });
  };

  const totalCapacity = useMemo(() => rooms.reduce((sum, _, i) => sum + getRoomCapacity(i), 0), [rooms]);

  const allComplete = rooms.every((_, i) => getRoomStatus(i) === "complete");
  const incompleteRooms = rooms.map((_, i) => i).filter(i => getRoomStatus(i) !== "complete");

  const setNumColumns = (roomIdx: number, n: number) => {
    n = Math.max(1, Math.min(10, n));
    const room = rooms[roomIdx];
    const cols: ColumnConfig[] = [];
    for (let i = 0; i < n; i++) {
      cols.push(room.columns[i] || { subColumns: 3, rows: 5 });
    }
    updateRoom(roomIdx, { columns: cols });
  };

  const updateColumn = (roomIdx: number, colIdx: number, field: keyof ColumnConfig, val: number) => {
    const room = rooms[roomIdx];
    const cols = [...room.columns];
    cols[colIdx] = { ...cols[colIdx], [field]: val };
    updateRoom(roomIdx, { columns: cols });
  };

  // Auto-init rooms with no columns
  useMemo(() => {
    rooms.forEach((room, i) => {
      if (room.columns.length === 0) {
        setNumColumns(i, 3);
      }
    });
  }, [rooms.length]);

  const statusDot = (status: "empty" | "partial" | "complete") => {
    const colors = { empty: "#999", partial: "#FF9500", complete: "#34C759" };
    return <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[status] }} />;
  };

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Configure Rooms</h1>
        <p className="text-muted-foreground text-base">Set up columns and rows for each room</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {rooms.map((room, ri) => {
          const isExpanded = expandedRoom === ri;
          const status = getRoomStatus(ri);
          const capacity = getRoomCapacity(ri);

          return (
            <div key={ri} className="glass-card overflow-hidden">
              {/* Header — always visible */}
              <button
                className="w-full flex items-center gap-3 p-5 text-left"
                onClick={() => setExpandedRoom(isExpanded ? -1 : ri)}
              >
                {statusDot(status)}
                <span className="text-base font-semibold flex-shrink-0">Room {ri + 1}</span>
                <input
                  type="text"
                  placeholder="e.g. Hall A, Room 101"
                  value={room.name}
                  onChange={e => {
                    e.stopPropagation();
                    updateRoom(ri, { name: e.target.value });
                  }}
                  onClick={e => e.stopPropagation()}
                  className="input-apple py-2 text-sm flex-1 min-w-0"
                  maxLength={60}
                />
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{capacity} seats</span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {/* Expanded body */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Main Columns</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={room.columns.length}
                      onChange={e => setNumColumns(ri, parseInt(e.target.value) || 1)}
                      className="input-apple w-32"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {room.columns.map((col, ci) => (
                      <div key={ci} className="bg-secondary/50 rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-semibold">Column {ci + 1}</h4>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Sub-columns (seats per row)</label>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={col.subColumns}
                            onChange={e => updateColumn(ri, ci, "subColumns", parseInt(e.target.value) || 1)}
                            className="input-apple"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Rows</label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={col.rows}
                            onChange={e => updateColumn(ri, ci, "rows", parseInt(e.target.value) || 1)}
                            className="input-apple"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mini preview */}
                  <div className="flex gap-3 justify-center overflow-x-auto py-2">
                    {room.columns.map((col, ci) => (
                      <div key={ci} className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-muted-foreground text-center mb-1">C{ci + 1}</span>
                        {Array.from({ length: Math.min(col.rows, 8) }).map((_, ri2) => (
                          <div key={ri2} className="flex gap-0.5">
                            {Array.from({ length: col.subColumns }).map((_, si) => (
                              <div key={si} className="rounded-sm bg-border" style={{ width: 7, height: 7 }} />
                            ))}
                          </div>
                        ))}
                        {col.rows > 8 && <span className="text-[8px] text-muted-foreground text-center">+{col.rows - 8}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total capacity bar */}
      <div className="max-w-3xl mx-auto mt-6 glass-card p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total capacity across all rooms:</span>
        <span className="text-base font-bold">{totalCapacity} seats</span>
      </div>

      {!allComplete && incompleteRooms.length > 0 && (
        <div className="max-w-3xl mx-auto mt-3 text-center">
          <span className="text-xs font-medium" style={{ color: "#FF9500" }}>
            ⚠️ Room {incompleteRooms.map(i => i + 1).join(" and Room ")} {incompleteRooms.length === 1 ? "is" : "are"} not fully configured
          </span>
        </div>
      )}

      <div className="flex justify-between mt-10 max-w-3xl mx-auto">
        <button className="btn-secondary" onClick={onBack}>
          <ChevronLeft size={16} strokeWidth={1.5} className="mr-1" /> Back
        </button>
        <button className="btn-primary" disabled={!allComplete} onClick={onNext}>
          Next: Add Students <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default Step2RoomConfig;
