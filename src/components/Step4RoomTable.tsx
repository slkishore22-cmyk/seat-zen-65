import { useMemo, useState, useCallback, useRef } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { Group, RoomLayout, Seat, getConflictIndices, normalShuffle, universityShuffle, getSubColGroupAssignment, detectSequenceGaps, InterleaveInfo } from "@/lib/shuffleEngine";
import { ShuffleType } from "@/pages/Index";
import DraggableSeatCard from "@/components/DraggableSeatCard";
import SeatCard from "@/components/SeatCard";
import ColorLegend from "@/components/ColorLegend";
import ActionBar from "@/components/ActionBar";
import { AlertTriangle, X, CheckCircle2, AlertCircle, Pencil, Undo2 } from "lucide-react";

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
  for (let c = 0; c < ci; c++) {
    offset += layout.columns[c].subColumns * layout.columns[c].rows;
  }
  return offset + ri * layout.columns[ci].subColumns + si;
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

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [swappedIds, setSwappedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Seat[][]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const conflictSet = useMemo(() => getConflictIndices(seatMap, layout), [seatMap, layout]);
  const conflictCountComputed = conflictSet.size;

  const groupGaps = useMemo(() => {
    if (shuffleType !== "normal") return [];
    return groups.map(g => ({
      group: g,
      gaps: detectSequenceGaps(g.members),
    })).filter(item => item.gaps.missing.length > 0);
  }, [groups, shuffleType]);

  const seatSequenceNumbers = useMemo(() => {
    if (shuffleType !== "normal") return new Map<number, number>();
    const counters = new Map<string, number>();
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

  const subColAssignments = useMemo(() => {
    if (shuffleType !== "normal") return [];
    return getSubColGroupAssignment(layout, groups);
  }, [layout, groups, shuffleType]);

  useState(() => {
    if (groupGaps.length > 0) {
      const timer = setTimeout(() => setShowGapWarning(false), 8000);
      return () => clearTimeout(timer);
    }
  });

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const fromPos = parseDndId(active.id as string);
    const toPos = parseDndId(over.id as string);
    if (!fromPos || !toPos) return;

    const fromIdx = seatFlatIndex(layout, fromPos.ci, fromPos.ri, fromPos.si);
    const toIdx = seatFlatIndex(layout, toPos.ci, toPos.ri, toPos.si);

    // Push current state to history
    setHistory(prev => [...prev.slice(-9), [...seatMap.map(s => ({ ...s }))]]);

    // Swap
    const newMap = [...seatMap.map(s => ({ ...s }))];
    const temp = { ...newMap[fromIdx] };
    newMap[fromIdx] = {
      ...newMap[fromIdx],
      rollNumber: newMap[toIdx].rollNumber,
      groupId: newMap[toIdx].groupId,
      color: newMap[toIdx].color,
      hex: newMap[toIdx].hex,
    };
    newMap[toIdx] = {
      ...newMap[toIdx],
      rollNumber: temp.rollNumber,
      groupId: temp.groupId,
      color: temp.color,
      hex: temp.hex,
    };
    setSeatMap(newMap);

    // Flash animation
    const ids = new Set([active.id as string, over.id as string]);
    setSwappedIds(ids);
    setTimeout(() => setSwappedIds(new Set()), 450);
  }, [seatMap, layout, setSeatMap]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setSeatMap(prev);
  }, [history, setSeatMap]);

  const handleReshuffle = useCallback(() => {
    const shuffledGroups = groups.map(g => ({
      ...g,
      members: [...g.members].sort(() => Math.random() - 0.5),
    }));
    if (shuffleType === "normal") {
      const result = normalShuffle(shuffledGroups, layout);
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
    setHistory([]);
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

  // Get the active seat for DragOverlay
  const activeSeat = useMemo(() => {
    if (!activeId) return null;
    const pos = parseDndId(activeId);
    if (!pos) return null;
    const idx = seatFlatIndex(layout, pos.ci, pos.ri, pos.si);
    return seatMap[idx] || null;
  }, [activeId, layout, seatMap]);

  // Render grid
  let globalIdx = 0;

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Room Arrangement</h1>
        <p className="text-muted-foreground text-sm">
          {shuffleType === "university" ? "University Shuffle" : "Normal Shuffle"} · {seatMap.filter(s => s.rollNumber).length} students
        </p>
      </div>

      {/* Sequence gap warning */}
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

      {/* Conflict banners */}
      {conflictCountComputed > 0 && (
        <div className="glass-card p-3 mb-4 max-w-3xl mx-auto flex items-center justify-center gap-3" style={{ backgroundColor: "#FF3B3010", borderColor: "#FF3B3040" }}>
          <AlertTriangle size={14} style={{ color: "#FF3B30" }} />
          <span className="text-sm font-medium" style={{ color: "#FF3B30" }}>
            ⚠️ {conflictCountComputed} conflicts — same department students are adjacent
          </span>
          {!editMode && !readOnly && (
            <span className="text-xs text-muted-foreground ml-2">Tap Edit Mode to fix manually</span>
          )}
          {shuffleType === "university" && !readOnly && (
            <button className="btn-secondary text-sm ml-2" onClick={handleAutoFix}>Auto-Fix</button>
          )}
        </div>
      )}

      {conflictCountComputed === 0 && seatMap.some(s => s.rollNumber) && (
        <div className="glass-card p-3 mb-4 max-w-3xl mx-auto flex items-center justify-center gap-2" style={{ backgroundColor: "#34C75910", borderColor: "#34C75940" }}>
          <CheckCircle2 size={14} style={{ color: "#34C759" }} />
          <span className="text-sm font-medium" style={{ color: "#34C759" }}>✓ No conflicts — all departments properly separated</span>
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && (
        <div className="glass-card p-4 mb-4 max-w-3xl mx-auto text-center" style={{ backgroundColor: "rgba(0, 122, 255, 0.08)", borderColor: "rgba(0, 122, 255, 0.3)" }}>
          <p className="text-sm font-semibold" style={{ color: "#007AFF" }}>✏️ Edit Mode — Drag any seat to swap</p>
          <p className="text-xs text-muted-foreground mt-1">Tap a seat and drag to another position</p>
        </div>
      )}

      <ColorLegend groups={groups} />

      {/* Interleave info for normal shuffle */}
      {shuffleType === "normal" && (localInterleaveInfo || interleaveInfo) && (() => {
        const info = localInterleaveInfo || interleaveInfo;
        const hasWarnings = (info?.columnWarnings?.length ?? 0) > 0;
        return (
          <div className="glass-card p-4 mt-4 mb-2 max-w-3xl mx-auto" style={{
            backgroundColor: !hasWarnings ? "#34C75910" : "#FF950010",
            borderColor: !hasWarnings ? "#34C75940" : "#FF950040",
          }}>
            <div className="flex items-start gap-3">
              {!hasWarnings ? (
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#34C759" }} />
              ) : (
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#FF9500" }} />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold mb-1.5">Department Arrangement</h4>
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Departments detected: <span className="font-medium text-foreground">{info?.departmentNames.join(", ")}</span></p>
                  <p>Sub-column pattern: <span className="font-mono font-medium text-foreground">{info?.pattern}</span> (each sub-column = one department)</p>
                  {!hasWarnings ? (
                    <p style={{ color: "#34C759" }}>✅ No same-department students appear consecutively in any column</p>
                  ) : (
                    <div>
                      <p style={{ color: "#FF9500" }}>⚠️ Column warnings:</p>
                      {info?.columnWarnings?.map((w, i) => (
                        <p key={i} className="ml-2" style={{ color: "#FF9500" }}>• {w}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Room grid with DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto mt-6">
          <div className="flex gap-6 min-w-max justify-center" key={animKey}>
            {layout.columns.map((col, ci) => {
              const startIdx = globalIdx;
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
                  {shuffleType === "normal" && colAssignments.length > 0 && (
                    <div className="flex items-center gap-1 mb-2 justify-center">
                      {colAssignments.map((a, i) => (
                        <div key={i} className="flex items-center gap-0.5 px-1" style={{ width: 72, justifyContent: "center" }}>
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
                          const dndId = makeDndId(ci, ri, si);
                          return (
                            <DraggableSeatCard
                              key={`${animKey}-${idx}`}
                              seat={seat}
                              dndId={dndId}
                              isConflict={conflictSet.has(idx)}
                              delay={idx * 8}
                              sequenceNumber={shuffleType === "normal" ? seatSequenceNumbers.get(idx) ?? null : null}
                              editMode={editMode}
                              isDragging={activeId === dndId}
                              isOver={false}
                              isAnyDragging={activeId !== null}
                              justSwapped={swappedIds.has(dndId)}
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

        <DragOverlay>
          {activeSeat ? (
            <div
              className="seat-card relative"
              style={{
                backgroundColor: activeSeat.hex ? `${activeSeat.hex}12` : undefined,
                borderLeft: `3px solid ${activeSeat.hex || "#ccc"}`,
                transform: "scale(1.08)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                opacity: 0.95,
                zIndex: 1000,
                cursor: "grabbing",
              }}
            >
              <span className="text-[10px] font-semibold leading-none truncate">{activeSeat.rollNumber || "—"}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
                <button
                  className="btn-secondary text-sm shrink-0"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  style={history.length === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                >
                  <Undo2 size={14} strokeWidth={1.5} className="mr-1.5" /> Undo
                </button>
              )}

              <ActionBar
                onReshuffle={handleReshuffle}
                onSave={onSave}
                onNewRoom={onNewRoom}
                onPrint={handlePrint}
                onHeightChange={setActionBarHeight}
                inline
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Step4RoomTable;
