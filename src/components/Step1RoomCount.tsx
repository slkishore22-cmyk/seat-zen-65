import { ChevronRight, DoorOpen } from "lucide-react";
import { useExamSession } from "@/hooks/useExamSession";

interface Props {
  onNext: () => void;
}

const Step1RoomCount = ({ onNext }: Props) => {
  const { session, setTotalRooms } = useExamSession();
  const count = session.totalRooms;

  const handleChange = (val: number) => {
    const clamped = Math.max(1, Math.min(20, val));
    setTotalRooms(clamped);
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

      <div className="flex justify-center">
        <button className="btn-primary" disabled={!isValid} onClick={onNext}>
          Configure Rooms <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default Step1RoomCount;
