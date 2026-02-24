import { useState } from "react";
import { Shuffle, Save, Plus, Printer } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onReshuffle: () => void;
  onSave: (name: string) => void;
  onNewRoom: () => void;
  onPrint: () => void;
}

const ActionBar = ({ onReshuffle, onSave, onNewRoom, onPrint }: Props) => {
  const [showSave, setShowSave] = useState(false);
  const [roomName, setRoomName] = useState("");

  const handleSave = () => {
    if (!roomName.trim()) return;
    onSave(roomName.trim());
    setShowSave(false);
    setRoomName("");
    toast.success("Room saved!", { duration: 2000 });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 glass-card" style={{ borderRadius: 0, borderBottom: "none", borderLeft: "none", borderRight: "none" }}>
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3 flex-nowrap overflow-x-auto justify-start md:justify-center">
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
