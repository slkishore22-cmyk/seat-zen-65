import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Seat } from "@/lib/shuffleEngine";
import { GripVertical } from "lucide-react";
import { AlertTriangle } from "lucide-react";

interface Props {
  seat: Seat;
  dndId: string;
  isConflict: boolean;
  delay: number;
  sequenceNumber?: number | null;
  editMode: boolean;
  isDragging: boolean;      // this specific card is being dragged
  isOver: boolean;           // something is being dragged over this card
  isAnyDragging: boolean;   // any card in the grid is being dragged
  justSwapped: boolean;      // flash animation after swap
}

const DraggableSeatCard = ({
  seat, dndId, isConflict, delay, sequenceNumber, editMode,
  isDragging, isOver, isAnyDragging, justSwapped,
}: Props) => {
  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id: dndId,
    disabled: !editMode,
  });

  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: dndId,
    disabled: !editMode,
  });

  const combinedRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  if (!seat.rollNumber) {
    return (
      <div
        ref={combinedRef}
        className="seat-empty"
        style={isOver || isDropOver ? {
          borderColor: "#007AFF",
          backgroundColor: "rgba(0, 122, 255, 0.08)",
          transform: "scale(1.03)",
        } : undefined}
        {...(editMode ? { ...attributes, ...listeners } : {})}
      >
        —
      </div>
    );
  }

  const style: React.CSSProperties = {
    backgroundColor: seat.hex ? `${seat.hex}12` : undefined,
    borderLeft: `3px solid ${seat.hex || "#ccc"}`,
    animationDelay: `${delay}ms`,
  };

  // Drag state
  if (isDragging) {
    style.opacity = 0.3;
    style.border = "2px dashed #86868B";
  } else if (isOver || isDropOver) {
    style.border = "2px solid #007AFF";
    style.backgroundColor = "rgba(0, 122, 255, 0.08)";
    style.transform = "scale(1.03)";
  } else if (isAnyDragging) {
    style.opacity = 0.7;
  }

  // Conflict pulse
  if (isConflict && !isDragging) {
    style.boxShadow = "0 0 0 2px #FF3B30";
  }

  // Swap flash
  if (justSwapped) {
    style.animation = "swap-flash 400ms ease-out";
  }

  return (
    <div
      ref={combinedRef}
      className={`seat-card ${!justSwapped ? "seat-animate" : ""} ${isConflict && !isDragging ? "seat-conflict" : ""} relative`}
      style={style}
      title={`Group: ${seat.groupId}`}
      {...(editMode ? { ...attributes, ...listeners } : {})}
    >
      {editMode && (
        <GripVertical
          size={10}
          className="absolute top-0.5 left-0.5"
          style={{ color: "#86868B", cursor: "grab" }}
        />
      )}
      {isConflict && !isDragging && (
        <AlertTriangle
          size={8}
          className="absolute -top-1 -right-1"
          style={{ color: "#FF3B30" }}
        />
      )}
      {sequenceNumber != null && !editMode && (
        <span
          className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full"
          style={{
            width: 16,
            height: 16,
            backgroundColor: seat.hex ? `${seat.hex}E6` : "#ccc",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {sequenceNumber}
        </span>
      )}
      <span className="text-[10px] font-semibold leading-none truncate">{seat.rollNumber}</span>
    </div>
  );
};

export default DraggableSeatCard;
