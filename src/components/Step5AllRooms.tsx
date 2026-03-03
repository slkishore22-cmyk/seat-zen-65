import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { getConflictIndices, getSubColGroupAssignment, detectSequenceGaps, extractNumericSuffix, normalShuffle, universityShuffle, distributeStudentsAcrossRooms, RoomResult, Seat, RoomLayout, InterleaveInfo } from "@/lib/shuffleEngine";
import { useExamSession, SavedSession } from "@/hooks/useExamSession";
import DraggableSeatCard from "@/components/DraggableSeatCard";
import ColorLegend from "@/components/ColorLegend";
import { AlertTriangle, Shuffle, Save, Plus, Printer, X, CheckCircle2, AlertCircle, Pencil, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onNewExam: () => void;
  readOnly?: boolean;
}

function makeDndId(ci: number, ri: number, si: number) {
  return `seat-${ci}-${ri}-${si}`;
}
function parseDndId(id: string) {
  const m = id.match(/^seat-(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  return { ci: parseInt(m[1]), ri: parseInt(m[2]), si: parseInt(m[3]) };
}
function seatFlatIndex(layout: RoomLayout, ci: number, ri: number, si: number): number {
  let offset = 0;
  for (let c = 0; c < ci; c++) offset += layout.columns[c].subColumns * layout.columns[c].rows;
  return offset + ri * layout.columns[ci].subColumns + si;
}

const Step5AllRooms = ({ onNewExam, readOnly = false }: Props) => {
  const { session, setRoomResults, setActiveRoomTab, addSession } = useExamSession();
  const { roomResults, activeRoomTab, shuffleType, allGroups, rooms } = session;
  const [animKey, setAnimKey] = useState(0);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [actionBarHeight, setActionBarHeight] = useState(96);
  const barRef = useRef<HTMLDivElement>(null);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [swappedIds, setSwappedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Seat[][]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const activeResult = roomResults[activeRoomTab];
  const activeLayout: RoomLayout | null = activeResult ? { columns: rooms[activeResult.roomIndex]?.columns || [] } : null;

  useEffect(() => {
    if (!barRef.current) return;
    const el = barRef.current;
    const emit = () => setActionBarHeight(Math.ceil(el.getBoundingClientRect().height));
    emit();
    if (typeof ResizeObserver !== "undefined") {
      const obs = new ResizeObserver(emit);
      obs.observe(el);
      return () => obs.disconnect();
    }
  }, []);

  const conflictSet = useMemo(() => {
    if (!activeResult || !activeLayout) return new Set<number>();
    return getConflictIndices(activeResult.seats, activeLayout);
  }, [activeResult, activeLayout]);

  const seatSequenceNumbers = useMemo(() => {
    if (shuffleType !== "normal" || !activeResult) return new Map<number, number>();
    const counters = new Map<string, number>();
    const result = new Map<number, number>();
    for (let i = 0; i < activeResult.seats.length; i++) {
      const seat = activeResult.seats[i];
      if (seat.rollNumber && seat.groupId) {
        const count = (counters.get(seat.groupId) || 0) + 1;
        counters.set(seat.groupId, count);
        result.set(i, count);
      }
    }
    return result;
  }, [activeResult, shuffleType]);

  const subColAssignments = useMemo(() => {
    if (shuffleType !== "normal" || !activeResult || !activeLayout) return [];
    return getSubColGroupAssignment(activeLayout, activeResult.groups);
  }, [activeLayout, activeResult, shuffleType]);

  const totalStudents = roomResults.reduce((s, r) => s + r.studentCount, 0);

  // DnD
  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as string), []);
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id || !activeLayout) return;
    const from = parseDndId(e.active.id as string);
    const to = parseDndId(e.over.id as string);
    if (!from || !to) return;
    const fromIdx = seatFlatIndex(activeLayout, from.ci, from.ri, from.si);
    const toIdx = seatFlatIndex(activeLayout, to.ci, to.ri, to.si);

    setHistory(prev => [...prev.slice(-9), [...activeResult.seats.map(s => ({ ...s }))]]);

    const newSeats = [...activeResult.seats.map(s => ({ ...s }))];
    const temp = { ...newSeats[fromIdx] };
    newSeats[fromIdx] = { ...newSeats[fromIdx], rollNumber: newSeats[toIdx].rollNumber, groupId: newSeats[toIdx].groupId, color: newSeats[toIdx].color, hex: newSeats[toIdx].hex };
    newSeats[toIdx] = { ...newSeats[toIdx], rollNumber: temp.rollNumber, groupId: temp.groupId, color: temp.color, hex: temp.hex };

    const newResults = [...roomResults];
    newResults[activeRoomTab] = { ...newResults[activeRoomTab], seats: newSeats };
    setRoomResults(newResults);

    const ids = new Set([e.active.id as string, e.over.id as string]);
    setSwappedIds(ids);
    setTimeout(() => setSwappedIds(new Set()), 450);
  }, [activeResult, activeLayout, roomResults, activeRoomTab, setRoomResults]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const newResults = [...roomResults];
    newResults[activeRoomTab] = { ...newResults[activeRoomTab], seats: prev };
    setRoomResults(newResults);
  }, [history, roomResults, activeRoomTab, setRoomResults]);

  const activeSeat = useMemo(() => {
    if (!activeId || !activeLayout || !activeResult) return null;
    const pos = parseDndId(activeId);
    if (!pos) return null;
    return activeResult.seats[seatFlatIndex(activeLayout, pos.ci, pos.ri, pos.si)] || null;
  }, [activeId, activeLayout, activeResult]);

  const handleReshuffleThis = useCallback(() => {
    if (!activeResult || !activeLayout) return;
    const shuffledGroups = activeResult.groups.map(g => ({ ...g, members: [...g.members].sort(() => Math.random() - 0.5) }));
    let newResult: Partial<RoomResult>;
    if (shuffleType === "normal") {
      const r = normalShuffle(shuffledGroups, activeLayout);
      newResult = { seats: r.seats, overflow: r.overflow, conflictCount: 0, studentCount: r.seats.filter(s => s.rollNumber).length, interleaveInfo: r.interleaveInfo };
    } else {
      const r = universityShuffle(shuffledGroups, activeLayout);
      newResult = { seats: r.seats, overflow: r.overflow, conflictCount: r.conflictCount, studentCount: r.seats.filter(s => s.rollNumber).length };
    }
    const newResults = [...roomResults];
    newResults[activeRoomTab] = { ...newResults[activeRoomTab], ...newResult };
    setRoomResults(newResults);
    setAnimKey(k => k + 1);
    setHistory([]);
  }, [activeResult, activeLayout, roomResults, activeRoomTab, shuffleType, setRoomResults]);

  const handleReshuffleAll = useCallback(() => {
    const results = distributeStudentsAcrossRooms(
      allGroups.map(g => ({ ...g, members: [...g.members].sort(() => Math.random() - 0.5) })),
      rooms, shuffleType
    );
    setRoomResults(results);
    setAnimKey(k => k + 1);
    setHistory([]);
  }, [allGroups, rooms, shuffleType, setRoomResults]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const saved: SavedSession = { id: crypto.randomUUID(), name: saveName.trim(), createdAt: new Date().toISOString(), shuffleType, totalStudents, roomResults };
    addSession(saved);
    setShowSave(false);
    setSaveName("");
    toast.success("All rooms saved!", { duration: 2000 });
  };

  const handlePrintThis = useCallback(() => {
    if (!activeResult || !activeLayout) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(buildPrintHtml([activeResult], [activeLayout], shuffleType));
    printWindow.document.close();
  }, [activeResult, activeLayout, shuffleType]);

  const handlePrintAll = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const layouts = roomResults.map(r => ({ columns: rooms[r.roomIndex]?.columns || [] }));
    printWindow.document.write(buildPrintHtml(roomResults, layouts, shuffleType));
    printWindow.document.close();
  }, [roomResults, rooms, shuffleType]);

  if (!activeResult || !activeLayout) return null;

  const conflictCountComputed = conflictSet.size;
  let globalIdx = 0;

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>All Rooms Arranged</h1>
        <p className="text-muted-foreground text-sm">
          {totalStudents} students across {roomResults.length} rooms — {shuffleType === "university" ? "University Shuffle" : "Normal Shuffle"}
        </p>
      </div>

      {/* Room tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 justify-center">
        {roomResults.map((rr, i) => (
          <button key={i} onClick={() => { setActiveRoomTab(i); setAnimKey(k => k + 1); setHistory([]); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-medium transition-all duration-200 shrink-0 ${activeRoomTab === i ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {rr.roomName}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-pill font-semibold ${activeRoomTab === i ? "bg-primary-foreground/20 text-primary-foreground" : "bg-border text-muted-foreground"}`}>{rr.studentCount}</span>
          </button>
        ))}
      </div>

      <div className="text-center text-xs text-muted-foreground mb-4">
        {activeResult.studentCount} students · {activeResult.groups.length} departments · {conflictCountComputed} conflicts
      </div>

      {/* Conflict / success banner */}
      {conflictCountComputed > 0 && (
        <div className="glass-card p-3 mb-4 max-w-3xl mx-auto flex items-center justify-center gap-3" style={{ backgroundColor: "#FF3B3010", borderColor: "#FF3B3040" }}>
          <AlertTriangle size={14} style={{ color: "#FF3B30" }} />
          <span className="text-sm font-medium" style={{ color: "#FF3B30" }}>⚠️ {conflictCountComputed} conflicts — same department students are adjacent</span>
          {!editMode && !readOnly && <span className="text-xs text-muted-foreground ml-2">Tap Edit Mode to fix</span>}
        </div>
      )}
      {conflictCountComputed === 0 && activeResult.seats.some(s => s.rollNumber) && (
        <div className="glass-card p-3 mb-4 max-w-3xl mx-auto flex items-center justify-center gap-2" style={{ backgroundColor: "#34C75910", borderColor: "#34C75940" }}>
          <CheckCircle2 size={14} style={{ color: "#34C759" }} />
          <span className="text-sm font-medium" style={{ color: "#34C759" }}>✓ No conflicts — all departments properly separated</span>
        </div>
      )}

      {editMode && (
        <div className="glass-card p-4 mb-4 max-w-3xl mx-auto text-center" style={{ backgroundColor: "rgba(0, 122, 255, 0.08)", borderColor: "rgba(0, 122, 255, 0.3)" }}>
          <p className="text-sm font-semibold" style={{ color: "#007AFF" }}>✏️ Edit Mode — Drag any seat to swap</p>
          <p className="text-xs text-muted-foreground mt-1">Tap a seat and drag to another position</p>
        </div>
      )}

      <ColorLegend groups={activeResult.groups} />

      {shuffleType === "normal" && activeResult.interleaveInfo && (() => {
        const info = activeResult.interleaveInfo;
        const hasWarnings = (info.columnWarnings?.length ?? 0) > 0;
        return (
          <div className="glass-card p-4 mt-4 mb-2 max-w-3xl mx-auto" style={{ backgroundColor: !hasWarnings ? "#34C75910" : "#FF950010", borderColor: !hasWarnings ? "#34C75940" : "#FF950040" }}>
            <div className="flex items-start gap-3">
              {!hasWarnings ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#34C759" }} /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#FF9500" }} />}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold mb-1.5">Department Arrangement</h4>
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Departments detected: <span className="font-medium text-foreground">{info.departmentNames.join(", ")}</span></p>
                  <p>Sub-column pattern: <span className="font-mono font-medium text-foreground">{info.pattern}</span> (each sub-column = one department)</p>
                  {!hasWarnings ? <p style={{ color: "#34C759" }}>✅ No same-department students appear consecutively in any column</p> : (
                    <div>
                      <p style={{ color: "#FF9500" }}>⚠️ Column warnings:</p>
                      {info.columnWarnings?.map((w, i) => <p key={i} className="ml-2" style={{ color: "#FF9500" }}>• {w}</p>)}
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
            {activeLayout.columns.map((col, ci) => {
              const startIdx = globalIdx;
              const colAssignments = subColAssignments.filter(a => a.columnIndex === ci);
              const colSeats: Seat[][] = [];
              for (let r = 0; r < col.rows; r++) {
                const row: Seat[] = [];
                for (let s = 0; s < col.subColumns; s++) { row.push(activeResult.seats[globalIdx]); globalIdx++; }
                colSeats.push(row);
              }
              return (
                <div key={ci}>
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-center mb-1">Column {ci + 1}</h4>
                  {shuffleType === "normal" && colAssignments.length > 0 && (
                    <div className="flex items-center gap-1 mb-2 justify-center">
                      {colAssignments.map((a, i) => (
                        <div key={i} className="flex items-center gap-0.5 px-1" style={{ width: 72, justifyContent: "center" }}>
                          {a.group && (<><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.group.hex }} /><span className="text-[8px] font-semibold uppercase tracking-wide truncate" style={{ color: a.group.hex }}>{a.group.label}</span></>)}
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
            <div className="seat-card relative" style={{ backgroundColor: activeSeat.hex ? `${activeSeat.hex}12` : undefined, borderLeft: `3px solid ${activeSeat.hex || "#ccc"}`, transform: "scale(1.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", opacity: 0.95, zIndex: 1000, cursor: "grabbing" }}>
              <span className="text-[10px] font-semibold leading-none truncate">{activeSeat.rollNumber || "—"}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {activeResult.overflow.length > 0 && (
        <div className="glass-card p-5 mt-8 max-w-3xl mx-auto">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle size={14} className="text-destructive" /> Overflow Students ({activeResult.overflow.length})</h3>
          <p className="text-xs text-muted-foreground mb-2">These students could not fit in this room:</p>
          <div className="flex flex-wrap gap-1.5">{activeResult.overflow.map(rn => <span key={rn} className="px-2 py-0.5 rounded-pill bg-secondary text-xs font-medium">{rn}</span>)}</div>
        </div>
      )}

      {!readOnly && (
        <>
          <div aria-hidden="true" style={{ height: actionBarHeight + 20 }} />
          <div ref={barRef} className="fixed bottom-0 left-0 right-0 z-40 glass-card" style={{ borderRadius: 0, borderBottom: "none", borderLeft: "none", borderRight: "none" }}>
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
              <button className="btn-secondary text-sm shrink-0" onClick={handleReshuffleThis}><Shuffle size={14} strokeWidth={1.5} className="mr-1.5" /> Re-shuffle This</button>
              <button className="btn-secondary text-sm shrink-0" onClick={handleReshuffleAll}><Shuffle size={14} strokeWidth={1.5} className="mr-1.5" /> Re-shuffle All</button>
              {showSave ? (
                <div className="flex items-center gap-2 shrink-0">
                  <input type="text" placeholder="Exam name..." maxLength={60} value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} className="input-apple py-2 text-sm w-44" autoFocus />
                  <button className="btn-primary text-sm shrink-0" onClick={handleSave} disabled={!saveName.trim()}>Save</button>
                  <button className="btn-secondary text-sm shrink-0" onClick={() => setShowSave(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn-secondary text-sm shrink-0" onClick={() => setShowSave(true)}><Save size={14} strokeWidth={1.5} className="mr-1.5" /> Save All</button>
              )}
              <button className="btn-secondary text-sm shrink-0" onClick={onNewExam}><Plus size={14} strokeWidth={1.5} className="mr-1.5" /> New Exam</button>
              <button className="btn-secondary text-sm shrink-0" onClick={handlePrintThis}><Printer size={14} strokeWidth={1.5} className="mr-1.5" /> Print This</button>
              <button className="btn-secondary text-sm shrink-0" onClick={handlePrintAll}><Printer size={14} strokeWidth={1.5} className="mr-1.5" /> Print All</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function buildPrintHtml(results: RoomResult[], layouts: RoomLayout[], shuffleType: string): string {
  let body = "";
  for (let ri = 0; ri < results.length; ri++) {
    const result = results[ri];
    const layout = layouts[ri];
    let seatIdx = 0;
    const colHtmls = layout.columns.map((col, ci) => {
      let rows = "";
      for (let r = 0; r < col.rows; r++) {
        let cells = "";
        for (let s = 0; s < col.subColumns; s++) {
          const seat = result.seats[seatIdx];
          const bg = seat?.hex ? `${seat.hex}20` : "transparent";
          const borderL = seat?.hex || "#ddd";
          cells += `<td style="padding:6px 10px;border:1px solid #eee;border-left:3px solid ${borderL};background:${bg};font-size:12px;font-weight:600;text-align:center">${seat?.rollNumber || "—"}</td>`;
          seatIdx++;
        }
        rows += `<tr>${cells}</tr>`;
      }
      return `<div style="flex:1"><h4 style="text-align:center;font-size:12px;color:#888;margin-bottom:8px">Column ${ci + 1}</h4><table style="border-collapse:collapse;width:100%">${rows}</table></div>`;
    });
    const legend = result.groups.map(g => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:16px"><span style="width:10px;height:10px;border-radius:50%;background:${g.hex}"></span>${g.label} (${g.members.length})</span>`).join("");
    body += `<div style="page-break-after:always;margin-bottom:40px">
      <h2 style="font-size:18px;font-weight:700;margin-bottom:4px">${result.roomName}</h2>
      <p style="font-size:13px;color:#888;margin-bottom:4px">${shuffleType === "university" ? "University Shuffle" : "Normal Shuffle"} · ${new Date().toLocaleDateString()}</p>
      <p style="font-size:13px;color:#888;margin-bottom:16px">${result.studentCount} students</p>
      <div style="margin-bottom:12px">${legend}</div>
      <div style="display:flex;gap:0">${colHtmls.join('<div style="width:24px"></div>')}</div>
    </div>`;
  }
  return `<!DOCTYPE html><html><head><title>Exam Rooms</title><style>body{font-family:-apple-system,sans-serif;padding:40px;color:#1d1d1f}@media print{button{display:none!important}}</style></head><body>
    <h1 style="font-size:20px;font-weight:700;margin-bottom:20px">Exam Room Arrangements</h1>
    ${body}
    <button onclick="window.print()" style="padding:8px 24px;background:#000;color:#fff;border:none;border-radius:980px;cursor:pointer;font-size:14px">Print</button>
  </body></html>`;
}

export default Step5AllRooms;
