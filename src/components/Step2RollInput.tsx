import { useCallback, useEffect, useMemo, useRef } from "react";
import { autoGroup, getTotalCapacity, parseRollNumbers, Group, RoomLayout } from "@/lib/shuffleEngine";
import { ChevronLeft, ChevronRight, AlertTriangle, Info, X } from "lucide-react";

interface Props {
  rollNumbers: string[];
  setRollNumbers: (rn: string[]) => void;
  groups: Group[];
  setGroups: (g: Group[]) => void;
  layout: RoomLayout;
  onNext: () => void;
  onBack: () => void;
}

const Step2RollInput = ({ rollNumbers, setRollNumbers, groups, setGroups, layout, onNext, onBack }: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const capacity = useMemo(() => getTotalCapacity(layout), [layout]);

  const handleInput = useCallback((val: string) => {
    const parsed = parseRollNumbers(val);
    setRollNumbers(parsed);
    setGroups(autoGroup(parsed));
  }, [setRollNumbers, setGroups]);

  const removeRoll = useCallback((rn: string) => {
    const next = rollNumbers.filter(r => r !== rn);
    setRollNumbers(next);
    setGroups(autoGroup(next));
  }, [rollNumbers, setRollNumbers, setGroups]);

  const totalStudents = rollNumbers.length;

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Add Students</h1>
        <p className="text-muted-foreground text-base">Paste or type all roll numbers for this room</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Textarea */}
        <div className="glass-card p-5">
          <textarea
            ref={textareaRef}
            className="input-apple min-h-[120px] resize-y"
            placeholder="Paste roll numbers here... e.g. 25A001, 24A001, 23A001 or 1, 2, 3, 11, 12, 13"
            onChange={e => handleInput(e.target.value)}
            defaultValue={rollNumbers.join(", ")}
          />
        </div>

        {/* Chip display */}
        {rollNumbers.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {groups.map(group =>
                group.members.map(rn => (
                  <span
                    key={rn}
                    className="chip-animate inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-pill text-xs font-medium"
                    style={{
                      backgroundColor: `${group.hex}20`,
                      color: group.hex,
                      border: `1px solid ${group.hex}40`,
                    }}
                  >
                    {rn}
                    <button onClick={() => removeRoll(rn)} className="p-0.5 rounded-full hover:bg-black/10 transition-colors">
                      <X size={10} strokeWidth={2} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Analysis panel */}
        {groups.length > 0 && (
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Roll Number Analysis</h3>

            {groups.map(group => (
              <div key={group.id} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.hex }}
                />
                <span className="text-sm font-medium">{group.label}</span>
                <span className="text-xs text-muted-foreground">— {group.members.length} students</span>
              </div>
            ))}

            <div className="flex items-center gap-4 pt-2 border-t border-border text-sm">
              <span>Total students: <strong>{totalStudents}</strong></span>
              <span>Seat capacity: <strong>{capacity}</strong></span>
              {totalStudents > capacity && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-pill" style={{ backgroundColor: "#FF3B3020", color: "#FF3B30" }}>
                  <AlertTriangle size={12} /> {totalStudents - capacity} overflow
                </span>
              )}
              {totalStudents < capacity && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-pill" style={{ backgroundColor: "#007AFF20", color: "#007AFF" }}>
                  <Info size={12} /> {capacity - totalStudents} empty seats
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-10 max-w-3xl mx-auto">
        <button className="btn-secondary" onClick={onBack}>
          <ChevronLeft size={16} strokeWidth={1.5} className="mr-1" /> Back
        </button>
        <button className="btn-primary" disabled={rollNumbers.length === 0} onClick={onNext}>
          Next <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default Step2RollInput;
