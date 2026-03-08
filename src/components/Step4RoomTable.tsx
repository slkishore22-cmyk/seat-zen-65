import { useMemo, useState, useCallback, useRef } from "react";
import { Group, RoomLayout, Seat, getConflictIndices, normalShuffle, universityShuffle, detectSequenceGaps, InterleaveInfo } from "@/lib/shuffleEngine";
import { ShuffleType } from "@/pages/Index";
import SeatCard from "@/components/SeatCard";
import ColorLegend from "@/components/ColorLegend";
import ActionBar from "@/components/ActionBar";
import { X, Pencil, Undo2 } from "lucide-react";

interface Props {
  layout: RoomLayout;
  groups: Group[];
  seatMap: Seat[];
  setSeatMap: (s: Seat[]) => void;
  conflictCount: number;
  setConflictCount: (n: number) => void;
  shuffleType: ShuffleType;
  onNewRoom: () => void;
  onSave: (name: string) => void;
  readOnly: boolean;
  interleaveInfo?: InterleaveInfo;
}

function makeDndId(ci: number, ri: number, si: number) {
  return `seat-${ci}-${ri}-${si}`;
}

function parseDndId(id: string): { ci: number; ri: number; si: number } | null {
  const m = id.match(/^seat-(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  return { ci: parseInt(m[1]), ri: parseInt(m[2]), si: parseInt(m[3]) };
}

function seatFlatIndex(layout: RoomLayout, ci: number, ri: number, si: number): number {
  let offset = 0;
  for (let c = 0; c < ci; c++) offset += layout.columns[c].subColumns * layout.columns[c].rows;
  return offset + ri * layout.columns[ci].subColumns + si;
}

const Step4RoomTable = ({
  layout, groups, seatMap, setSeatMap, conflictCount,
  setConflictCount, shuffleType, onNewRoom, onSave, readOnly,
  interleaveInfo,
}: Props) => {
  const [animKey, setAnimKey] = useState(0);
  const [showGapWarning, setShowGapWarning] = useState(true);
  const [actionBarHeight, setActionBarHeight] = useState(96);
  const [localInterleaveInfo, setLocalInterleaveInfo] = useState<InterleaveInfo | undefined>(interleaveInfo);

  const [editMode, setEditMode] = useState(false);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [swappedIds, setSwappedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Seat[][]>([]);

  const groupGaps = useMemo(() => {
    if (shuffleType !== "normal") return [];
    return groups.map(g => ({ group: g, gaps: detectSequenceGaps(g.members) })).filter(item => item.gaps.missing.length > 0);
  }, [groups, shuffleType]);

  useState(() => {
    if (groupGaps.length > 0) {
      const timer = setTimeout(() => setShowGapWarning(false), 8000);
      return () => clearTimeout(timer);
    }
  });

  // Drag handlers
  const handleDragStart = useCallback((_e: React.DragEvent, id: string) => setDragSourceId(id), []);
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverId(id); }, []);
  const handleDragLeave = useCallback(() => setDragOverId(null), []);
  const handleDragEnd = useCallback(() => { setDragSourceId(null); setDragOverId(null); }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragSourceId || dragSourceId === targetId) { setDragSourceId(null); return; }
    const from = parseDndId(dragSourceId);
    const to = parseDndId(targetId);
    if (!from || !to) { setDragSourceId(null); return; }
    const fromIdx = seatFlatIndex(layout, from.ci, from.ri, from.si);
    const toIdx = seatFlatIndex(layout, to.ci, to.ri, to.si);

    setHistory(prev => [...prev.slice(-9), [...seatMap.map(s => ({ ...s }))]]);
    const newMap = seatMap.map(s => ({ ...s }));
    const temp = { ...newMap[fromIdx] };
    newMap[fromIdx] = { ...newMap[fromIdx], rollNumber: newMap[toIdx].rollNumber, groupId: newMap[toIdx].groupId, color: newMap[toIdx].color, hex: newMap[toIdx].hex };
    newMap[toIdx] = { ...newMap[toIdx], rollNumber: temp.rollNumber, groupId: temp.groupId, color: temp.color, hex: temp.hex };
    setSeatMap(newMap);

    const ids = new Set([dragSourceId, targetId]);
    setSwappedIds(ids);
    setTimeout(() => setSwappedIds(new Set()), 450);
    setDragSourceId(null);
  }, [dragSourceId, layout, seatMap, setSeatMap]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    setSeatMap(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
  }, [history, setSeatMap]);

  const handleReshuffle = useCallback(() => {
    const shuffledGroups = groups.map(g => ({ ...g, members: [...g.members].sort(() => Math.random() - 0.5) }));
    if (shuffleType === "normal") {
      const result = normalShuffle(shuffledGroups, layout);
      setSeatMap(result.seats); setOverflow(result.overflow); setConflictCount(0); setLocalInterleaveInfo(result.interleaveInfo);
    } else {
      const r = universityShuffle(shuffledGroups, layout);
      setSeatMap(r.seats); setOverflow(r.overflow); setConflictCount(r.conflictCount);
    }
    setAnimKey(k => k + 1); setShowGapWarning(true); setHistory([]);
  }, [groups, layout, shuffleType, setSeatMap, setOverflow, setConflictCount]);

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
    const legend = groups.map(g => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:16px"><span style="width:10px;height:10px;border-radius:50%;background:${g.hex}"></span>${g.label} (${g.members.length})</span>`).join("");
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Room Arrangement</title><style>body{font-family:-apple-system,sans-serif;padding:40px;color:#1d1d1f}@media print{button{display:none!important}}</style></head><body>
      <h1 style="font-size:20px;font-weight:700;margin-bottom:4px">Room Arrangement</h1>
      <p style="font-size:13px;color:#888;margin-bottom:4px">${shuffleType === "university" ? "University Shuffle" : "Normal Shuffle"} · ${new Date().toLocaleDateString()}</p>
      <p style="font-size:13px;color:#888;margin-bottom:20px">Total students: ${seatMap.filter(s => s.rollNumber).length}</p>
      <div style="margin-bottom:16px">${legend}</div>
      <div style="display:flex;gap:0">${colHtmls.join('<div style="width:24px"></div>')}</div>
      <br/><button onclick="window.print()" style="padding:8px 24px;background:#000;color:#fff;border:none;border-radius:980px;cursor:pointer;font-size:14px">Print</button>
    </body></html>`);
    printWindow.document.close();
  }, [layout, seatMap, groups, shuffleType]);

  let globalIdx = 0;

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Room Arrangement</h1>
        <p className="text-muted-foreground text-sm">
          {shuffleType === "university" ? "University Shuffle" : "Normal Shuffle"} · {seatMap.filter(s => s.rollNumber).length} students
        </p>
      </div>

      {shuffleType === "normal" && groupGaps.length > 0 && showGapWarning && (
        <div className="glass-card p-5 mb-6 max-w-3xl mx-auto relative" style={{ backgroundColor: "#FF950015", borderColor: "#FF950040" }}>
          <button onClick={() => setShowGapWarning(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors">
            <X size={14} strokeWidth={2} />
          </button>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#FF9500" }}>⚠️ Sequence Gaps Detected</h3>
          {groupGaps.map(({ group, gaps }) => (
            <div key={group.id} className="flex items-center gap-2 text-xs mb-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.hex }} />
              <span className="font-medium">{group.label}:</span>
              <span className="text-muted-foreground">Missing roll numbers {gaps.missing.map(n => String(n).padStart(3, '0')).join(', ')}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">These gaps are handled automatically.</p>
        </div>
      )}

      {editMode && (
        <div className="glass-card p-4 mb-4 max-w-3xl mx-auto text-center" style={{ backgroundColor: "rgba(0, 122, 255, 0.08)", borderColor: "rgba(0, 122, 255, 0.3)" }}>
          <p className="text-sm font-semibold" style={{ color: "#007AFF" }}>✏️ Edit Mode — Drag any seat to swap</p>
          <p className="text-xs text-muted-foreground mt-1">Tap a seat and drag to another position</p>
        </div>
      )}

      <ColorLegend groups={groups} />

      {/* Room grid */}
      <div className="overflow-x-auto mt-6">
        <div
          className="min-w-max mx-auto"
          style={{ background: "hsl(var(--card))", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        >
          <div className="flex" style={{ gap: 32 }}>
            {layout.columns.map((col, ci) => {
              const startIdx = globalIdx;
              const colSeats: Seat[][] = [];
              for (let r = 0; r < col.rows; r++) {
                const row: Seat[] = [];
                for (let s = 0; s < col.subColumns; s++) { row.push(seatMap[globalIdx]); globalIdx++; }
                colSeats.push(row);
              }
              return (
                <div key={ci} className="flex" style={ci < layout.columns.length - 1 ? { borderRight: "1px solid #E5E5EA", paddingRight: 32 } : undefined}>
                  <div>
                    <h4 style={{ fontSize: 11, letterSpacing: 1.5, color: "#86868B", textTransform: "uppercase", textAlign: "center", marginBottom: 12, fontWeight: 600 }}>
                      Column {ci + 1}
                    </h4>
                    <div className="flex flex-col" style={{ gap: 8 }}>
                      {colSeats.map((row, ri) => (
                        <div key={ri} className="flex items-center" style={{ gap: 8 }}>
                          <span style={{ width: 28, fontSize: 11, color: "#86868B", textAlign: "right", fontFamily: "-apple-system, sans-serif", flexShrink: 0 }}>R{ri + 1}</span>
                          {row.map((seat, si) => {
                            const idx = startIdx + ri * col.subColumns + si;
                            const dndId = makeDndId(ci, ri, si);
                            return (
                              <SeatCard
                                key={`${animKey}-${idx}`}
                                seat={seat}
                                dndId={dndId}
                                editMode={editMode}
                                isDragOver={dragOverId === dndId}
                                isDragging={dragSourceId === dndId}
                                justSwapped={swappedIds.has(dndId)}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onDragEnd={handleDragEnd}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {overflow.length > 0 && (
        <div className="glass-card p-5 mt-8 max-w-3xl mx-auto">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-destructive" /> Overflow Students ({overflow.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">These students could not fit in the room:</p>
          <div className="flex flex-wrap gap-1.5">
            {overflow.map(rn => <span key={rn} className="px-2 py-0.5 rounded-pill bg-secondary text-xs font-medium">{rn}</span>)}
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          <div aria-hidden="true" style={{ height: actionBarHeight + 20 }} />
          <div className="fixed bottom-0 left-0 right-0 z-40 glass-card" style={{ borderRadius: 0, borderBottom: "none", borderLeft: "none", borderRight: "none" }}>
            <div className="max-w-6xl mx-auto px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex items-center gap-3 flex-nowrap overflow-x-auto justify-start md:justify-center">
              <button
                className={`btn-pill text-sm shrink-0 transition-all duration-200 ${editMode ? "text-white" : "btn-secondary"}`}
                style={editMode ? { backgroundColor: "#007AFF" } : undefined}
                onClick={() => setEditMode(m => !m)}
              >
                <Pencil size={14} strokeWidth={1.5} className="mr-1.5" />
                {editMode ? "Exit Edit" : "Edit Mode"}
              </button>
              {editMode && (
                <button className="btn-secondary text-sm shrink-0" onClick={handleUndo} disabled={history.length === 0} style={history.length === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
                  <Undo2 size={14} strokeWidth={1.5} className="mr-1.5" /> Undo
                </button>
              )}
              <ActionBar onReshuffle={handleReshuffle} onSave={onSave} onNewRoom={onNewRoom} onPrint={handlePrint} onHeightChange={setActionBarHeight} inline />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Step4RoomTable;
