import { useMemo, useState, useCallback } from "react";
import { Group, RoomLayout, Seat, getConflictIndices, normalShuffle, universityShuffle, getSubColGroupAssignment, detectSequenceGaps, extractNumericSuffix, InterleaveInfo } from "@/lib/shuffleEngine";
import { ShuffleType } from "@/pages/Index";
import SeatCard from "@/components/SeatCard";
import ColorLegend from "@/components/ColorLegend";
import ActionBar from "@/components/ActionBar";
import { AlertTriangle, X, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  layout: RoomLayout;
  groups: Group[];
  seatMap: Seat[];
  setSeatMap: (s: Seat[]) => void;
  overflow: string[];
  conflictCount: number;
  setConflictCount: (n: number) => void;
  setOverflow: (o: string[]) => void;
  shuffleType: ShuffleType;
  onNewRoom: () => void;
  onSave: (name: string) => void;
  readOnly: boolean;
  interleaveInfo?: InterleaveInfo;
}

const Step4RoomTable = ({
  layout, groups, seatMap, setSeatMap, overflow, conflictCount,
  setConflictCount, setOverflow, shuffleType, onNewRoom, onSave, readOnly,
  interleaveInfo,
}: Props) => {
  const [animKey, setAnimKey] = useState(0);
  const [showGapWarning, setShowGapWarning] = useState(true);
  const [actionBarHeight, setActionBarHeight] = useState(96);
  const [localInterleaveInfo, setLocalInterleaveInfo] = useState<InterleaveInfo | undefined>(interleaveInfo);
  const conflictSet = useMemo(() => getConflictIndices(seatMap, layout), [seatMap, layout]);

  // Compute sequence gaps for normal shuffle
  const groupGaps = useMemo(() => {
    if (shuffleType !== "normal") return [];
    return groups.map(g => ({
      group: g,
      gaps: detectSequenceGaps(g.members),
    })).filter(item => item.gaps.missing.length > 0);
  }, [groups, shuffleType]);

  // Compute per-group sequence counters for normal shuffle badges
  const seatSequenceNumbers = useMemo(() => {
    if (shuffleType !== "normal") return new Map<number, number>();
    const counters = new Map<string, number>(); // groupId -> counter
    const result = new Map<number, number>();
    for (let i = 0; i < seatMap.length; i++) {
      const seat = seatMap[i];
      if (seat.rollNumber && seat.groupId) {
        const count = (counters.get(seat.groupId) || 0) + 1;
        counters.set(seat.groupId, count);
        result.set(i, count);
      }
    }
    return result;
  }, [seatMap, shuffleType]);

  // Sub-column group assignments for normal shuffle
  const subColAssignments = useMemo(() => {
    if (shuffleType !== "normal") return [];
    return getSubColGroupAssignment(layout, groups);
  }, [layout, groups, shuffleType]);

  // Auto-dismiss gap warning
  useState(() => {
    if (groupGaps.length > 0) {
      const timer = setTimeout(() => setShowGapWarning(false), 8000);
      return () => clearTimeout(timer);
    }
  });

  const handleReshuffle = useCallback(() => {
    const shuffledGroups = groups.map(g => ({
      ...g,
      members: [...g.members].sort(() => Math.random() - 0.5),
    }));

    let result;
    if (shuffleType === "normal") {
      result = normalShuffle(shuffledGroups, layout);
      setSeatMap(result.seats);
      setOverflow(result.overflow);
      setConflictCount(0);
      setLocalInterleaveInfo(result.interleaveInfo);
    } else {
      const r = universityShuffle(shuffledGroups, layout);
      setSeatMap(r.seats);
      setOverflow(r.overflow);
      setConflictCount(r.conflictCount);
    }
    setAnimKey(k => k + 1);
    setShowGapWarning(true);
  }, [groups, layout, shuffleType, setSeatMap, setOverflow, setConflictCount]);

  const handleAutoFix = useCallback(() => {
    const r = universityShuffle(groups, layout);
    setSeatMap(r.seats);
    setOverflow(r.overflow);
    setConflictCount(r.conflictCount);
    setAnimKey(k => k + 1);
  }, [groups, layout, setSeatMap, setOverflow, setConflictCount]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let seatIdx = 0;
    const colHtmls = layout.columns.map((col, ci) => {
      let rows = "";
      for (let r = 0; r < col.rows; r++) {
        let cells = "";
        for (let s = 0; s < col.subColumns; s++) {
          const seat = seatMap[seatIdx];
          const bg = seat?.hex ? `${seat.hex}20` : "transparent";
          const borderL = seat?.hex || "#ddd";
          cells += `<td style="padding:6px 10px;border:1px solid #eee;border-left:3px solid ${borderL};background:${bg};font-size:12px;font-weight:600;text-align:center">${seat?.rollNumber || "—"}</td>`;
          seatIdx++;
        }
        rows += `<tr>${cells}</tr>`;
      }
      return `<div style="flex:1"><h4 style="text-align:center;font-size:12px;color:#888;margin-bottom:8px">Column ${ci + 1}</h4><table style="border-collapse:collapse;width:100%">${rows}</table></div>`;
    });

    const tableHtml = colHtmls.join('<div style="width:24px"></div>');
    const legend = groups.map(g => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:16px"><span style="width:10px;height:10px;border-radius:50%;background:${g.hex}"></span>${g.label} (${g.members.length})</span>`).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Room Arrangement</title><style>body{font-family:-apple-system,sans-serif;padding:40px;color:#1d1d1f}@media print{button{display:none!important}}</style></head><body>
      <h1 style="font-size:20px;font-weight:700;margin-bottom:4px">Room Arrangement</h1>
      <p style="font-size:13px;color:#888;margin-bottom:4px">${shuffleType === "university" ? "University Shuffle" : "Normal Shuffle"} · ${new Date().toLocaleDateString()}</p>
      <p style="font-size:13px;color:#888;margin-bottom:20px">Total students: ${seatMap.filter(s => s.rollNumber).length}</p>
      <div style="margin-bottom:16px">${legend}</div>
      <div style="display:flex;gap:0">${tableHtml}</div>
      <br/><button onclick="window.print()" style="padding:8px 24px;background:#000;color:#fff;border:none;border-radius:980px;cursor:pointer;font-size:14px">Print</button>
    </body></html>`);
    printWindow.document.close();
  }, [layout, seatMap, groups, shuffleType]);

  // Render grid by columns
  let globalIdx = 0;

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Room Arrangement</h1>
        <p className="text-muted-foreground text-sm">
          {shuffleType === "university" ? "University Shuffle" : "Normal Shuffle"} · {seatMap.filter(s => s.rollNumber).length} students
        </p>
      </div>

      {/* Sequence gap warning for normal shuffle */}
      {shuffleType === "normal" && groupGaps.length > 0 && showGapWarning && (
        <div className="glass-card p-5 mb-6 max-w-3xl mx-auto relative" style={{ backgroundColor: "#FF950015", borderColor: "#FF950040" }}>
          <button
            onClick={() => setShowGapWarning(false)}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#FF9500" }}>
            ⚠️ Sequence Gaps Detected
          </h3>
          {groupGaps.map(({ group, gaps }) => (
            <div key={group.id} className="flex items-center gap-2 text-xs mb-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.hex }} />
              <span className="font-medium">{group.label}:</span>
              <span className="text-muted-foreground">Missing roll numbers {gaps.missing.map(n => String(n).padStart(3, '0')).join(', ')}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">These gaps are handled automatically. The existing students are arranged in order.</p>
        </div>
      )}

      {conflictCount > 0 && (
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-pill" style={{ backgroundColor: "#FF3B3015", color: "#FF3B30" }}>
            <AlertTriangle size={14} /> {conflictCount} conflicts detected
          </span>
          {!readOnly && (
            <button className="btn-secondary text-sm" onClick={handleAutoFix}>Auto-Fix</button>
          )}
        </div>
      )}

      <ColorLegend groups={groups} />

      {/* Interleave summary card for normal shuffle */}
      {shuffleType === "normal" && (localInterleaveInfo || interleaveInfo) && (() => {
        const info = localInterleaveInfo || interleaveInfo;
        return (
          <div className="glass-card p-4 mt-4 mb-2 max-w-3xl mx-auto" style={{
            backgroundColor: info?.validated ? "#34C75910" : "#FF3B3010",
            borderColor: info?.validated ? "#34C75940" : "#FF3B3040",
          }}>
            <div className="flex items-start gap-3">
              {info?.validated ? (
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#34C759" }} />
              ) : (
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#FF3B30" }} />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold mb-1.5">Smart Department Interleaving</h4>
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Departments detected: <span className="font-medium text-foreground">{info?.departmentNames.join(", ")}</span></p>
                  <p>Interleave pattern: <span className="font-mono font-medium text-foreground">{info?.pattern}</span></p>
                  {info?.validated ? (
                    <p style={{ color: "#34C759" }}>✅ No two students from same department seated consecutively</p>
                  ) : (
                    <p style={{ color: "#FF3B30" }}>⚠️ Interleaving issue detected at seat {(info?.failedAt ?? 0) + 1}. Please regenerate.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Room grid */}
      <div className="overflow-x-auto mt-6">
        <div className="flex gap-6 min-w-max justify-center" key={animKey}>
          {layout.columns.map((col, ci) => {
            const startIdx = globalIdx;

            // Get sub-col assignments for this column
            const colAssignments = subColAssignments.filter(a => a.columnIndex === ci);

            const colSeats: Seat[][] = [];
            for (let r = 0; r < col.rows; r++) {
              const row: Seat[] = [];
              for (let s = 0; s < col.subColumns; s++) {
                row.push(seatMap[globalIdx]);
                globalIdx++;
              }
              colSeats.push(row);
            }

            return (
              <div key={ci}>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-center mb-1">
                  Column {ci + 1}
                </h4>
                {/* Sub-column department labels for normal shuffle */}
                {shuffleType === "normal" && colAssignments.length > 0 && (
                  <div className="flex items-center gap-1 mb-2 justify-center">
                    {colAssignments.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-0.5 px-1"
                        style={{ width: 72, justifyContent: "center" }}
                      >
                        {a.group && (
                          <>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.group.hex }} />
                            <span className="text-[8px] font-semibold uppercase tracking-wide truncate" style={{ color: a.group.hex }}>
                              {a.group.label}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  {colSeats.map((row, ri) => (
                    <div key={ri} className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground w-5 text-right mr-0.5 select-none">R{ri + 1}</span>
                      {row.map((seat, si) => {
                        const idx = startIdx + ri * col.subColumns + si;
                        return (
                          <SeatCard
                            key={`${animKey}-${idx}`}
                            seat={seat}
                            isConflict={conflictSet.has(idx)}
                            delay={idx * 8}
                            sequenceNumber={shuffleType === "normal" ? seatSequenceNumbers.get(idx) ?? null : null}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {overflow.length > 0 && (
        <div className="glass-card p-5 mt-8 max-w-3xl mx-auto">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-destructive" /> Overflow Students ({overflow.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">These students could not fit in the room:</p>
          <div className="flex flex-wrap gap-1.5">
            {overflow.map(rn => (
              <span key={rn} className="px-2 py-0.5 rounded-pill bg-secondary text-xs font-medium">{rn}</span>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          <div aria-hidden="true" style={{ height: actionBarHeight + 20 }} />
          <ActionBar
            onReshuffle={handleReshuffle}
            onSave={onSave}
            onNewRoom={onNewRoom}
            onPrint={handlePrint}
            onHeightChange={setActionBarHeight}
          />
        </>
      )}
    </div>
  );
};

export default Step4RoomTable;
