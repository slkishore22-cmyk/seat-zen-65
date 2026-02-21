import { useEffect, useMemo } from "react";
import { ColumnConfig, RoomLayout, getTotalCapacity } from "@/lib/shuffleEngine";
import { ChevronRight } from "lucide-react";

interface Props {
  columns: ColumnConfig[];
  setColumns: (cols: ColumnConfig[]) => void;
  onNext: () => void;
}

const Step1RoomSetup = ({ columns, setColumns, onNext }: Props) => {
  const numColumns = columns.length;

  const setNumColumns = (n: number) => {
    if (n < 1) n = 1;
    if (n > 10) n = 10;
    const next: ColumnConfig[] = [];
    for (let i = 0; i < n; i++) {
      next.push(columns[i] || { subColumns: 3, rows: 5 });
    }
    setColumns(next);
  };

  const updateColumn = (idx: number, field: keyof ColumnConfig, val: number) => {
    const next = [...columns];
    next[idx] = { ...next[idx], [field]: val };
    setColumns(next);
  };

  useEffect(() => {
    if (columns.length === 0) setNumColumns(3);
  }, []);

  const isValid = columns.length > 0 && columns.every(c => c.rows >= 1 && c.subColumns >= 1 && c.subColumns <= 6);
  const capacity = useMemo(() => getTotalCapacity({ columns }), [columns]);

  // Room preview
  const maxRows = Math.max(...columns.map(c => c.rows), 0);

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Set Up Your Room</h1>
        <p className="text-muted-foreground text-base">Define how many columns this exam hall has</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Config panel */}
        <div className="flex-1 space-y-6">
          <div className="glass-card p-6">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Main Columns</label>
            <input
              type="number"
              min={1}
              max={10}
              value={numColumns}
              onChange={e => setNumColumns(parseInt(e.target.value) || 1)}
              className="input-apple w-32"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {columns.map((col, i) => (
              <div key={i} className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Column {i + 1}</h3>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sub-columns (seats per row)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={col.subColumns}
                    onChange={e => updateColumn(i, "subColumns", parseInt(e.target.value) || 1)}
                    className="input-apple"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Rows</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={col.rows}
                    onChange={e => updateColumn(i, "rows", parseInt(e.target.value) || 1)}
                    className="input-apple"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">Total capacity: <span className="font-semibold text-foreground">{capacity} seats</span></p>
        </div>

        {/* Live preview */}
        <div className="lg:w-72">
          <div className="glass-card p-5 sticky top-24">
            <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Room Preview</h3>
            <div className="flex gap-3 justify-center overflow-x-auto">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-1">
                  <span className="text-[9px] text-muted-foreground text-center mb-1">C{ci + 1}</span>
                  {Array.from({ length: Math.min(col.rows, 12) }).map((_, ri) => (
                    <div key={ri} className="flex gap-0.5">
                      {Array.from({ length: col.subColumns }).map((_, si) => (
                        <div
                          key={si}
                          className="rounded-sm bg-border transition-all duration-200"
                          style={{ width: 8, height: 8 }}
                        />
                      ))}
                    </div>
                  ))}
                  {col.rows > 12 && <span className="text-[8px] text-muted-foreground text-center">+{col.rows - 12}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-10">
        <button className="btn-primary" disabled={!isValid} onClick={onNext}>
          Next <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
        </button>
      </div>
    </div>
  );
};

export default Step1RoomSetup;
