import { Seat } from "@/lib/shuffleEngine";

interface Props {
  seat: Seat;
  dndId: string;
  editMode: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  justSwapped: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

const SeatCard = ({
  seat, dndId, editMode, isDragOver, isDragging, justSwapped,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: Props) => {
  if (!seat.rollNumber) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground select-none"
        style={{
          width: 80,
          height: 40,
          borderRadius: 10,
          border: isDragOver ? "2px dashed #007AFF" : "1.5px dashed hsl(var(--border))",
          backgroundColor: isDragOver ? "rgba(0,122,255,0.08)" : undefined,
          fontSize: 11,
          transition: "all 150ms ease",
        }}
        onDragOver={editMode ? (e) => onDragOver(e, dndId) : undefined}
        onDragLeave={editMode ? onDragLeave : undefined}
        onDrop={editMode ? (e) => onDrop(e, dndId) : undefined}
      >
        —
      </div>
    );
  }

  const style: React.CSSProperties = {
    width: 80,
    height: 40,
    borderRadius: 10,
    backgroundColor: seat.hex ? `${seat.hex}40` : "hsl(var(--secondary))",
    borderLeft: `4px solid ${seat.hex || "hsl(var(--border))"}`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 150ms ease",
    cursor: editMode ? "grab" : "default",
  };

  if (isDragging) {
    style.opacity = 0.3;
    style.border = "2px dashed #86868B";
    style.borderLeft = "2px dashed #86868B";
  } else if (isDragOver) {
    style.border = "2px dashed #007AFF";
    style.borderLeft = "2px dashed #007AFF";
    style.backgroundColor = "rgba(0,122,255,0.08)";
    style.transform = "scale(1.03)";
  }

  if (justSwapped) {
    style.animation = "swap-flash 400ms ease-out";
  }

  return (
    <div
      style={style}
      draggable={editMode}
      onDragStart={editMode ? (e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(e, dndId); } : undefined}
      onDragOver={editMode ? (e) => onDragOver(e, dndId) : undefined}
      onDragLeave={editMode ? onDragLeave : undefined}
      onDrop={editMode ? (e) => onDrop(e, dndId) : undefined}
      onDragEnd={editMode ? onDragEnd : undefined}
    >
      <span className="roll-number" style={{ fontSize: 13, fontWeight: 700, color: seat.hex || "#1D1D1F", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {seat.rollNumber}
      </span>
    </div>
  );
};

export default SeatCard;
