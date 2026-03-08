import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { getConflictIndices, detectSequenceGaps, normalShuffle, universityShuffle, distributeStudentsAcrossRooms, RoomResult, Seat, RoomLayout, InterleaveInfo } from "@/lib/shuffleEngine";
import { useExamSession, SavedSession } from "@/hooks/useExamSession";
import SeatCard from "@/components/SeatCard";
import ColorLegend from "@/components/ColorLegend";
import { Shuffle, Save, Plus, Printer, Pencil, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onNewExam: () => void;
  readOnly?: boolean;
}

function seededShuffle(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  const { session, setRoomResults, setActiveRoomTab, addSession, setCurrentSessionId } = useExamSession();
  const { roomResults, activeRoomTab, shuffleType, allGroups, rooms, currentSessionId } = session;
  const [animKey, setAnimKey] = useState(0);
  const [actionBarHeight, setActionBarHeight] = useState(96);
  const [actionBarHeight, setActionBarHeight] = useState(96);
  const barRef = useRef<HTMLDivElement>(null);

  const [editMode, setEditMode] = useState(false);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [swappedIds, setSwappedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Seat[][]>([]);

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

  const totalStudents = roomResults.reduce((s, r) => s + r.studentCount, 0);

  // Drag handlers
  const handleDragStart = useCallback((_e: React.DragEvent, id: string) => setDragSourceId(id), []);
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverId(id); }, []);
  const handleDragLeave = useCallback(() => setDragOverId(null), []);
  const handleDragEnd = useCallback(() => { setDragSourceId(null); setDragOverId(null); }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragSourceId || dragSourceId === targetId || !activeLayout || !activeResult) { setDragSourceId(null); return; }
    const from = parseDndId(dragSourceId);
    const to = parseDndId(targetId);
    if (!from || !to) { setDragSourceId(null); return; }
    const fromIdx = seatFlatIndex(activeLayout, from.ci, from.ri, from.si);
    const toIdx = seatFlatIndex(activeLayout, to.ci, to.ri, to.si);

    setHistory(prev => [...prev.slice(-9), [...activeResult.seats.map(s => ({ ...s }))]]);
    const newSeats = activeResult.seats.map(s => ({ ...s }));
    const temp = { ...newSeats[fromIdx] };
    newSeats[fromIdx] = { ...newSeats[fromIdx], rollNumber: newSeats[toIdx].rollNumber, groupId: newSeats[toIdx].groupId, color: newSeats[toIdx].color, hex: newSeats[toIdx].hex };
    newSeats[toIdx] = { ...newSeats[toIdx], rollNumber: temp.rollNumber, groupId: temp.groupId, color: temp.color, hex: temp.hex };

    const newResults = [...roomResults];
    newResults[activeRoomTab] = { ...newResults[activeRoomTab], seats: newSeats };
    setRoomResults(newResults);

    const ids = new Set([dragSourceId, targetId]);
    setSwappedIds(ids);
    setTimeout(() => setSwappedIds(new Set()), 450);
    setDragSourceId(null);
  }, [dragSourceId, activeLayout, activeResult, roomResults, activeRoomTab, setRoomResults]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const newResults = [...roomResults];
    newResults[activeRoomTab] = { ...newResults[activeRoomTab], seats: prev };
    setRoomResults(newResults);
  }, [history, roomResults, activeRoomTab, setRoomResults]);

  const handleReshuffleThis = useCallback(async () => {
    if (!activeResult || !activeLayout) return;
    const shuffledGroups = activeResult.groups.map(g => ({ ...g, members: seededShuffle(g.members) }));
    let newResult: Partial<RoomResult>;
    if (shuffleType === "normal") {
      const r = normalShuffle(shuffledGroups, activeLayout);
      newResult = { seats: r.seats, conflictCount: 0, studentCount: r.seats.filter(s => s.rollNumber).length, interleaveInfo: r.interleaveInfo };
    } else {
      const r = universityShuffle(shuffledGroups, activeLayout);
      newResult = { seats: r.seats, conflictCount: r.conflictCount, studentCount: r.seats.filter(s => s.rollNumber).length };
    }
    const newResults = [...roomResults];
    newResults[activeRoomTab] = { ...newResults[activeRoomTab], ...newResult };
    setRoomResults(newResults);
    setAnimKey(k => k + 1);
    setHistory([]);
    // Auto-save if session exists
    if (currentSessionId) {
      await supabase.from('exam_sessions').update({ rooms: newResults } as any).eq('id', currentSessionId);
      toast.success("Auto saved.", { duration: 1500 });
    }
  }, [activeResult, activeLayout, roomResults, activeRoomTab, shuffleType, setRoomResults, currentSessionId]);

  const handleReshuffleAll = useCallback(async () => {
    const results = await distributeStudentsAcrossRooms(
      allGroups.map(g => ({ ...g, members: seededShuffle(g.members) })),
      rooms, shuffleType
    );
    setRoomResults(results);
    setAnimKey(k => k + 1);
    setHistory([]);
    // Auto-save if session exists
    if (currentSessionId) {
      await supabase.from('exam_sessions').update({ rooms: results } as any).eq('id', currentSessionId);
      toast.success("Auto saved.", { duration: 1500 });
    }
  }, [allGroups, rooms, shuffleType, setRoomResults, currentSessionId]);

  const handleSave = async () => {
    const userSession = (() => {
      try { return JSON.parse(localStorage.getItem("user_session") || ""); } catch { return null; }
    })();
    if (!userSession) {
      toast.error("You must be logged in to save.");
      return;
    }

    const totalStudentCount = roomResults.reduce((sum, r) => sum + r.studentCount, 0);
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const autoName = `Exam ${today} ${userSession.full_name || ""}`.trim();

    const payload = {
      exam_name: autoName,
      shuffle_type: shuffleType,
      rooms: roomResults as any,
      groups: allGroups as any,
      total_students: totalStudentCount,
      user_id: userSession.id,
    };

    const { data, error } = await supabase
      .from('exam_sessions')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      toast.error("Save failed. Please try again.");
      console.error("Save error:", error);
    } else if (data) {
      setCurrentSessionId(data.id);
      toast.success("Saved successfully.", { duration: 2000 });
    }
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
        {activeResult.studentCount} students · {activeResult.groups.length} departments
      </div>

      {editMode && (
        <div className="glass-card p-4 mb-4 max-w-3xl mx-auto text-center" style={{ backgroundColor: "rgba(0, 122, 255, 0.08)", borderColor: "rgba(0, 122, 255, 0.3)" }}>
          <p className="text-sm font-semibold" style={{ color: "#007AFF" }}>✏️ Edit Mode — Drag any seat to swap</p>
          <p className="text-xs text-muted-foreground mt-1">Tap a seat and drag to another position</p>
        </div>
      )}

      <ColorLegend groups={activeResult.groups} />

      {/* Room grid */}
      <div className="overflow-x-auto mt-6">
        <div
          className="min-w-max mx-auto animate-fade-in"
          style={{ background: "hsl(var(--card))", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          key={animKey}
        >
          <div className="flex" style={{ gap: 32 }}>
            {activeLayout.columns.map((col, ci) => {
              const startIdx = globalIdx;
              const colSeats: Seat[][] = [];
              for (let r = 0; r < col.rows; r++) {
                const row: Seat[] = [];
                for (let s = 0; s < col.subColumns; s++) { row.push(activeResult.seats[globalIdx]); globalIdx++; }
                colSeats.push(row);
              }
              return (
                <div key={ci} className="flex" style={ci < activeLayout.columns.length - 1 ? { borderRight: "1px solid #E5E5EA", paddingRight: 32 } : undefined}>
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
              <button className="btn-secondary text-sm shrink-0" onClick={handleSave}><Save size={14} strokeWidth={1.5} className="mr-1.5" /> Save All</button>
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

const DEPT_SHAPES = ['■', '●', '▲', '◆', '★'];
function getDeptShape(groupIndex: number): string {
  return DEPT_SHAPES[Math.min(groupIndex, DEPT_SHAPES.length - 1)];
}

function buildPrintHtml(results: RoomResult[], layouts: RoomLayout[], shuffleType: string): string {
  let body = "";
  for (let ri = 0; ri < results.length; ri++) {
    const result = results[ri];
    const layout = layouts[ri];
    const isLast = ri === results.length - 1;

    // SECTION 1 — Page Header
    const header = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:18px;font-weight:700">College Name</div>
          <div style="font-size:14px">Exam Seating Arrangement</div>
        </div>
        <div style="text-align:right;font-size:12px;line-height:1.8">
          <div>Room No: ________________</div>
          <div>Exam Date: ________________</div>
          <div>Exam / Subject: ____________________________</div>
        </div>
      </div>
      <div style="border-bottom:1.5px solid #000;margin-bottom:8px"></div>`;

    // SECTION 2 — Department Summary Bar
    const deptSummary = result.groups.map((g, gi) =>
      `${getDeptShape(gi)} ${g.label}: ${g.members.length}`
    ).join('  |  ');
    const summaryBar = `
      <div style="font-size:11px;padding:6px;border-bottom:1px solid #ccc;background:#f5f5f5;margin-bottom:10px">
        Total: ${result.studentCount}  |  ${deptSummary}
      </div>`;

    // Build group index map for shape lookup
    const groupShapeMap: Record<string, string> = {};
    result.groups.forEach((g, gi) => { groupShapeMap[g.id] = getDeptShape(gi); });

    // SECTION 3 — Seat Table
    let seatIdx = 0;
    const colHtmls = layout.columns.map((col, ci) => {
      let rows = "";
      for (let r = 0; r < col.rows; r++) {
        let cells = `<td style="padding:4px 2px;font-size:10px;color:#888;text-align:right;border:none;width:20px">R${r + 1}</td>`;
        for (let s = 0; s < col.subColumns; s++) {
          const seat = result.seats[seatIdx];
          const shape = seat?.groupId ? (groupShapeMap[seat.groupId] || '★') : '';
          const roll = seat?.rollNumber || '—';
          cells += `<td style="padding:2px;border:none"><div style="display:flex;align-items:center;gap:2px">` +
            `<div style="width:70px;height:36px;border:1px solid #000;position:relative;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">` +
            `${roll}` +
            `<span style="position:absolute;top:1px;right:3px;font-size:8px;font-weight:700">${shape}</span>` +
            `</div>` +
            `<div style="width:10px;height:10px;border:1px solid #000;flex-shrink:0"></div>` +
            `</div></td>`;
          seatIdx++;
        }
        rows += `<tr>${cells}</tr>`;
      }
      return `<div style="flex:1${ci < layout.columns.length - 1 ? ';border-right:1px solid #000;padding-right:12px;margin-right:12px' : ''}">` +
        `<div style="text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600">Column ${ci + 1}</div>` +
        `<table style="border-collapse:collapse;width:100%">${rows}</table></div>`;
    });
    const seatGrid = `<div style="display:flex;gap:0;margin-bottom:14px">${colHtmls.join('')}</div>`;

    // SECTION 4 — Attendance Summary Table
    let attRows = result.groups.map((g, gi) =>
      `<tr><td style="border:1px solid #000;padding:6px 10px;font-size:11px">${getDeptShape(gi)} ${g.label}</td>` +
      `<td style="border:1px solid #000;padding:6px 10px;font-size:11px;text-align:center">${g.members.length}</td>` +
      `<td style="border:1px solid #000;padding:6px 10px;min-width:80px"></td>` +
      `<td style="border:1px solid #000;padding:6px 10px;min-width:80px"></td></tr>`
    ).join('');
    attRows += `<tr style="font-weight:700"><td style="border:1px solid #000;padding:6px 10px;font-size:11px">TOTAL</td>` +
      `<td style="border:1px solid #000;padding:6px 10px;font-size:11px;text-align:center">${result.studentCount}</td>` +
      `<td style="border:1px solid #000;padding:6px 10px"></td>` +
      `<td style="border:1px solid #000;padding:6px 10px"></td></tr>`;
    const attTable = `
      <table style="border-collapse:collapse;margin-bottom:14px;width:auto">
        <tr style="font-weight:700;background:#f5f5f5">
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px">Department</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px">Total Students</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px">Present</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px">Absent</td>
        </tr>
        ${attRows}
      </table>`;

    // SECTION 5 — Invigilator Sign-off
    const signOff = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:10px">
        <div style="font-size:11px;line-height:2.2">
          <div>Invigilator Name: _______________________________</div>
          <div>Date: _______________</div>
          <div>Time In: ____________&nbsp;&nbsp;&nbsp;Time Out: ____________</div>
        </div>
        <div style="text-align:right;font-size:11px">
          <div style="margin-bottom:4px">Signature:</div>
          <div style="width:150px;height:60px;border:1px solid #000"></div>
        </div>
      </div>
      <div style="border-top:1px solid #000;margin-top:10px;padding-top:6px;font-size:11px;line-height:2">
        <div>Remarks: _____________________________________________</div>
        <div>__________________________________________________</div>
      </div>`;

    body += `<div class="${isLast ? '' : 'page-break'}" style="margin-bottom:0">
      ${header}${summaryBar}${seatGrid}${attTable}${signOff}
    </div>`;
  }

  return `<!DOCTYPE html><html><head><title>Exam Seating Arrangement</title>
<style>
  body { font-family: Arial, sans-serif; padding: 0; margin: 15mm; color: #000; }
  @media print {
    * { color: #000 !important; background: #fff !important; }
    .no-print { display: none !important; }
    .page-break { page-break-after: always; }
    body { margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 15mm; }
  }
</style></head><body>
    ${body}
    <button class="no-print" onclick="window.print()" style="margin-top:20px;padding:8px 24px;background:#000;color:#fff;border:none;border-radius:980px;cursor:pointer;font-size:14px">Print</button>
  </body></html>`;
}

export default Step5AllRooms;
