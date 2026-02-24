import { useEffect, useRef, useState } from "react";
import { Shuffle, Save, Plus, Printer } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onReshuffle: () => void;
  onSave: (name: string) => void;
  onNewRoom: () => void;
  onPrint: () => void;
  onHeightChange?: (height: number) => void;
}

const ActionBar = ({ onReshuffle, onSave, onNewRoom, onPrint, onHeightChange }: Props) => {
  const [showSave, setShowSave] = useState(false);
  const [roomName, setRoomName] = useState("");
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onHeightChange || !barRef.current) return;

    const element = barRef.current;
    const emitHeight = () => onHeightChange(Math.ceil(element.getBoundingClientRect().height));
    emitHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", emitHeight);
      return () => window.removeEventListener("resize", emitHeight);
    }

    const observer = new ResizeObserver(emitHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const handleSave = () => {
    if (!roomName.trim()) return;
    onSave(roomName.trim());
    setShowSave(false);
    setRoomName("");
    toast.success("Room saved!", { duration: 2000 });
  };

  return (
    <div ref={barRef} className="fixed bottom-0 left-0 right-0 z-40 glass-card" style={{ borderRadius: 0, borderBottom: "none", borderLeft: "none", borderRight: "none" }}>
      <div className="max-w-6xl mx-auto px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex items-center gap-3 flex-nowrap overflow-x-auto justify-start md:justify-center">
        <button className="btn-secondary text-sm shrink-0" onClick={onReshuffle}>
          <Shuffle size={14} strokeWidth={1.5} className="mr-1.5" /> Re-shuffle
        </button>

        {showSave ? (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="Room name..."
              maxLength={60}
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              className="input-apple py-2 text-sm w-44"
              autoFocus
            />
            <button className="btn-primary text-sm shrink-0" onClick={handleSave} disabled={!roomName.trim()}>Save</button>
            <button className="btn-secondary text-sm shrink-0" onClick={() => setShowSave(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-secondary text-sm shrink-0" onClick={() => setShowSave(true)}>
            <Save size={14} strokeWidth={1.5} className="mr-1.5" /> Save Room
          </button>
        )}

        <button className="btn-secondary text-sm shrink-0" onClick={onNewRoom}>
          <Plus size={14} strokeWidth={1.5} className="mr-1.5" /> New Room
        </button>

        <button className="btn-secondary text-sm shrink-0" onClick={onPrint}>
          <Printer size={14} strokeWidth={1.5} className="mr-1.5" /> Print
        </button>
      </div>
    </div>
  );
};

export default ActionBar;
