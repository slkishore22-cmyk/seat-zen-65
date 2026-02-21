import { Seat } from "@/lib/shuffleEngine";

interface Props {
  seat: Seat;
  isConflict: boolean;
  delay: number;
}

const SeatCard = ({ seat, isConflict, delay }: Props) => {
  if (!seat.rollNumber) {
    return <div className="seat-empty">—</div>;
  }

  return (
    <div
      className={`seat-card seat-animate ${isConflict ? "seat-conflict" : ""}`}
      style={{
        backgroundColor: seat.hex ? `${seat.hex}15` : undefined,
        borderLeft: `3px solid ${seat.hex || "#ccc"}`,
        animationDelay: `${delay}ms`,
        color: "#1D1D1F",
      }}
      title={`Group: ${seat.groupId}`}
    >
      <span className="text-[10px] font-bold leading-none truncate px-1">{seat.rollNumber}</span>
    </div>
  );
};

export default SeatCard;
