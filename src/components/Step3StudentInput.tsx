import { useCallback, useMemo, useRef } from "react";
import { autoGroup, getTotalCapacity, parseRollNumbers, detectSequenceGaps } from "@/lib/shuffleEngine";
import { ChevronLeft, ChevronRight, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import { useExamSession } from "@/hooks/useExamSession";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const Step3StudentInput = ({ onNext, onBack }: Props) => {
  const { session, setRawInput, setAllGroups } = useExamSession();
  const { rawInput, allGroups, rooms } = session;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rollNumbers = useMemo(() => parseRollNumbers(rawInput), [rawInput]);

  const handleInput = useCallback((val: string) => {
    setRawInput(val);
    const parsed = parseRollNumbers(val);
    setAllGroups(autoGroup(parsed));
  }, [setRawInput, setAllGroups]);

  const removeRoll = useCallback((rn: string) => {
    const next = rollNumbers.filter(r => r !== rn);
    setRawInput(next.join(", "));
    setAllGroups(autoGroup(next));
  }, [rollNumbers, setRawInput, setAllGroups]);

  const totalStudents = rollNumbers.length;

  const roomCapacities = useMemo(() =>
    rooms.map((r, i) => ({
      name: r.name || `Room ${i + 1}`,
      capacity: getTotalCapacity({ columns: r.columns }),
    }))
  , [rooms]);

  const totalCapacity = roomCapacities.reduce((s, r) => s + r.capacity, 0);
  const diff = totalStudents - totalCapacity;

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Add All Students</h1>
        <p className="text-muted-foreground text-base">Paste roll numbers from all departments together</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Textarea */}
        <div className="glass-card p-5">
          <textarea
            ref={textareaRef}
            className="input-apple min-h-[120px] resize-y"
            placeholder="Paste roll numbers here... e.g. 25CS001, 25CS002, 25EC001, 25EC002"
            onChange={e => handleInput(e.target.value)}
            defaultValue={rawInput}
          />
        </div>

        {/* Chip display */}
        {rollNumbers.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {allGroups.map(group =>
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

        {/* Two-panel summary */}
        {allGroups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* LEFT — Student Summary */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Student Summary</h3>
              <p className="text-xs text-muted-foreground">Total students detected: <strong className="text-foreground">{totalStudents}</strong></p>
              {allGroups.map(group => {
                const gaps = detectSequenceGaps(group.members);
                return (
                  <div key={group.id} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.hex }} />
                      <span className="text-sm font-medium">{group.label}</span>
                      <span className="text-xs text-muted-foreground">— {group.members.length} students</span>
                    </div>
                    <div className="ml-5 text-xs text-muted-foreground">
                      <span>Sequence: {gaps.ranges}</span>
                      {gaps.missing.length > 0 && (
                        <span className="ml-2" style={{ color: "#FF9500" }}>
                          Missing: {gaps.missing.map(n => String(n).padStart(3, '0')).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT — Room Capacity Summary */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Room Capacity Summary</h3>
              {roomCapacities.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{r.name}</span>
                  <span className="font-medium">{r.capacity} seats</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-border">
                <span>Total capacity</span>
                <span>{totalCapacity} seats</span>
              </div>

              {/* Fit indicator */}
              {totalStudents > 0 && (
                <div className="pt-2">
                  {diff > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-pill" style={{ backgroundColor: "#FF3B3015", color: "#FF3B30" }}>
                      <AlertTriangle size={12} /> {diff} students exceed room capacity
                    </span>
                  )}
                  {diff < 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-pill" style={{ backgroundColor: "#007AFF15", color: "#007AFF" }}>
                      <Info size={12} /> {Math.abs(diff)} seats will remain empty
                    </span>
                  )}
                  {diff === 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-pill" style={{ backgroundColor: "#34C75915", color: "#34C759" }}>
                      <CheckCircle2 size={12} /> Perfect fit — all seats filled
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-10 max-w-4xl mx-auto">
        <button className="btn-secondary" onClick={onBack}>
          <ChevronLeft size={16} strokeWidth={1.5} className="mr-1" /> Back
        </button>
        <button className="btn-primary" disabled={rollNumbers.length === 0} onClick={onNext}>
          Next: Choose Arrangement <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default Step3StudentInput;
