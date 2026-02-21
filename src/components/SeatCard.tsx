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
        backgroundColor: seat.hex ? `${seat.hex}12` : undefined,
        borderLeft: `3px solid ${seat.hex || "#ccc"}`,
        animationDelay: `${delay}ms`,
      }}
      title={`Group: ${seat.groupId}`}
    >
      <span className="text-[10px] font-semibold leading-none truncate">{seat.rollNumber}</span>
    </div>
  );
};

export default SeatCard;
