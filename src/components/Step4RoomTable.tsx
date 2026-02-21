import { useMemo, useState, useCallback } from "react";
import { Group, RoomLayout, Seat, getConflictIndices, normalShuffle, universityShuffle } from "@/lib/shuffleEngine";
import { ShuffleType } from "@/pages/Index";
import SeatCard from "@/components/SeatCard";
import ColorLegend from "@/components/ColorLegend";
import ActionBar from "@/components/ActionBar";
import { AlertTriangle } from "lucide-react";

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
}

const Step4RoomTable = ({
  layout, groups, seatMap, setSeatMap, overflow, conflictCount,
  setConflictCount, setOverflow, shuffleType, onNewRoom, onSave, readOnly,
}: Props) => {
  const [animKey, setAnimKey] = useState(0);
  const conflictSet = useMemo(() => getConflictIndices(seatMap), [seatMap]);

  const handleReshuffle = useCallback(() => {
    // Shuffle groups to get different seed
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
    } else {
      const r = universityShuffle(shuffledGroups, layout);
      setSeatMap(r.seats);
      setOverflow(r.overflow);
      setConflictCount(r.conflictCount);
    }
    setAnimKey(k => k + 1);
  }, [groups, layout, shuffleType, setSeatMap, setOverflow, setConflictCount]);

  const handleAutoFix = useCallback(() => {
    // Re-run university shuffle to try to fix
    const r = universityShuffle(groups, layout);
    setSeatMap(r.seats);
    setOverflow(r.overflow);
    setConflictCount(r.conflictCount);
    setAnimKey(k => k + 1);
  }, [groups, layout, setSeatMap, setOverflow, setConflictCount]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let tableHtml = "";
    let seatIdx = 0;

    // Build column HTML
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

    tableHtml = colHtmls.join('<div style="width:24px"></div>');

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

      {/* Room grid */}
      <div className="overflow-x-auto mt-6">
        <div className="flex gap-6 min-w-max justify-center" key={animKey}>
          {layout.columns.map((col, ci) => {
            const startIdx = globalIdx;
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
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-center mb-3">
                  Column {ci + 1}
                </h4>
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
        <ActionBar
          onReshuffle={handleReshuffle}
          onSave={onSave}
          onNewRoom={onNewRoom}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
};

export default Step4RoomTable;
