import { Seat } from "@/lib/shuffleEngine";

interface Props {
  seat: Seat;
  isConflict: boolean;
  delay: number;
  sequenceNumber?: number | null; // Only for Normal Shuffle
}

const SeatCard = ({ seat, isConflict, delay, sequenceNumber }: Props) => {
  if (!seat.rollNumber) {
    return <div className="seat-empty">—</div>;
  }

  return (
    <div
      className={`seat-card seat-animate ${isConflict ? "seat-conflict" : ""} relative`}
      style={{
        backgroundColor: seat.hex ? `${seat.hex}12` : undefined,
        borderLeft: `3px solid ${seat.hex || "#ccc"}`,
        animationDelay: `${delay}ms`,
      }}
      title={`Group: ${seat.groupId}`}
    >
      {sequenceNumber != null && (
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

export default SeatCard;
