// ==========================================
// EXAM SEATING SHUFFLE ENGINE
// Pure utility — no React, no side effects
// ==========================================

export const GROUP_COLORS = [
  { name: "Red", hex: "#FF3B30", hsl: "4 100% 59%" },
  { name: "Green", hex: "#34C759", hsl: "142 69% 50%" },
  { name: "Blue", hex: "#007AFF", hsl: "211 100% 50%" },
  { name: "Orange", hex: "#FF9500", hsl: "33 100% 50%" },
  { name: "Purple", hex: "#AF52DE", hsl: "280 58% 60%" },
  { name: "Teal", hex: "#5AC8FA", hsl: "199 92% 65%" },
  { name: "Pink", hex: "#FF2D55", hsl: "349 100% 59%" },
  { name: "Yellow", hex: "#FFCC00", hsl: "48 100% 50%" },
];

export interface ColumnConfig {
  subColumns: number;
  rows: number;
}

export interface RoomLayout {
  columns: ColumnConfig[];
}

export interface Group {
  id: string;
  label: string;
  color: string;
  hex: string;
  members: string[];
}

export interface Seat {
  columnIndex: number;
  rowIndex: number;
  subColumnIndex: number;
  rollNumber: string | null;
  groupId: string | null;
  color: string | null;
  hex: string | null;
}

// Step A — Roll Number Parser
export function parseRollNumbers(raw: string): string[] {
  const tokens = raw.split(/[,\s\n\t]+/).map(t => t.trim()).filter(Boolean);
  return [...new Set(tokens)];
}

// Natural sort comparator
function naturalCompare(a: string, b: string): number {
  const ax: (string | number)[] = [];
  const bx: (string | number)[] = [];
  a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push($1 ? parseInt($1) : $2); return ''; });
  b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push($1 ? parseInt($1) : $2); return ''; });
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    if (i >= ax.length) return -1;
    if (i >= bx.length) return 1;
    const ai = ax[i], bi = bx[i];
    if (typeof ai === 'number' && typeof bi === 'number') {
      if (ai !== bi) return ai - bi;
    } else {
      const cmp = String(ai).localeCompare(String(bi));
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

// Step B — Auto Grouper
export function autoGroup(rollNumbers: string[]): Group[] {
  const groups = new Map<string, string[]>();

  for (const rn of rollNumbers) {
    let prefix: string;

    // Check if purely numeric
    if (/^\d+$/.test(rn)) {
      const num = parseInt(rn);
      const tens = Math.floor(num / 10) * 10;
      prefix = tens === 0 ? "0s" : `${tens}s`;
    } else {
      // Alphanumeric: extract prefix before sequential digits at end
      const match = rn.match(/^(.+?)(\d+)$/);
      if (match) {
        prefix = match[1];
      } else {
        prefix = "misc";
      }
    }

    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix)!.push(rn);
  }

  // Sort each group's members naturally
  const result: Group[] = [];
  let colorIdx = 0;
  const sortedKeys = [...groups.keys()].sort(naturalCompare);

  for (const key of sortedKeys) {
    const members = groups.get(key)!;
    members.sort(naturalCompare);
    const color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
    result.push({
      id: `group-${colorIdx}`,
      label: key === "misc" ? "Misc" : key,
      color: color.hsl,
      hex: color.hex,
      members,
    });
    colorIdx++;
  }

  return result;
}

// Calculate total capacity
export function getTotalCapacity(layout: RoomLayout): number {
  return layout.columns.reduce((sum, col) => sum + col.subColumns * col.rows, 0);
}

// Create empty seat grid
function createEmptyGrid(layout: RoomLayout): Seat[] {
  const seats: Seat[] = [];
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c];
    for (let r = 0; r < col.rows; r++) {
      for (let s = 0; s < col.subColumns; s++) {
        seats.push({
          columnIndex: c,
          rowIndex: r,
          subColumnIndex: s,
          rollNumber: null,
          groupId: null,
          color: null,
          hex: null,
        });
      }
    }
  }
  return seats;
}

// Step C — Normal Shuffle
export function normalShuffle(groups: Group[], layout: RoomLayout): { seats: Seat[]; overflow: string[] } {
  const seats = createEmptyGrid(layout);
  const numGroups = groups.length;
  if (numGroups === 0) return { seats, overflow: [] };

  // Track how many we've used from each group
  const groupPointers = new Array(numGroups).fill(0);
  const overflow: string[] = [];

  for (const seat of seats) {
    const groupIdx = seat.subColumnIndex % numGroups;
    const group = groups[groupIdx];
    if (groupPointers[groupIdx] < group.members.length) {
      seat.rollNumber = group.members[groupPointers[groupIdx]];
      seat.groupId = group.id;
      seat.color = group.color;
      seat.hex = group.hex;
      groupPointers[groupIdx]++;
    }
  }

  // Collect overflow (unplaced students)
  for (let g = 0; g < numGroups; g++) {
    for (let i = groupPointers[g]; i < groups[g].members.length; i++) {
      overflow.push(groups[g].members[i]);
    }
  }

  return { seats, overflow };
}

// Get neighbors of a seat in the grid
function getNeighborIndices(seats: Seat[], idx: number): number[] {
  const seat = seats[idx];
  const neighbors: number[] = [];
  for (let j = 0; j < seats.length; j++) {
    if (j === idx) continue;
    const other = seats[j];
    if (other.columnIndex !== seat.columnIndex) continue;
    // Same column — check adjacency
    const sameRow = other.rowIndex === seat.rowIndex && Math.abs(other.subColumnIndex - seat.subColumnIndex) === 1;
    const sameSubCol = other.subColumnIndex === seat.subColumnIndex && Math.abs(other.rowIndex - seat.rowIndex) === 1;
    if (sameRow || sameSubCol) neighbors.push(j);
  }
  return neighbors;
}

// Check if placing groupId at idx causes conflict
function hasConflict(seats: Seat[], idx: number, groupId: string): boolean {
  const neighbors = getNeighborIndices(seats, idx);
  return neighbors.some(n => seats[n].groupId === groupId);
}

// Step D — University Shuffle
export function universityShuffle(groups: Group[], layout: RoomLayout): { seats: Seat[]; overflow: string[]; conflictCount: number } {
  const seats = createEmptyGrid(layout);
  const numGroups = groups.length;

  if (numGroups <= 1) {
    // Can't avoid adjacency with 1 group — fallback to normal
    const result = normalShuffle(groups, layout);
    return { ...result, conflictCount: 0 };
  }

  // Phase 1 — Interleave
  const maxLen = Math.max(...groups.map(g => g.members.length));
  const pool: { roll: string; groupId: string; color: string; hex: string }[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.members.length) {
        pool.push({ roll: g.members[i], groupId: g.id, color: g.color, hex: g.hex });
      }
    }
  }

  const overflow: string[] = [];
  const capacity = seats.length;
  const toPlace = pool.slice(0, capacity);
  for (let i = capacity; i < pool.length; i++) {
    overflow.push(pool[i].roll);
  }

  // Phase 2 — Constraint-based placement
  const remaining = [...toPlace];

  for (let idx = 0; idx < seats.length && remaining.length > 0; idx++) {
    // Find first student that doesn't conflict
    let placed = false;
    for (let j = 0; j < remaining.length; j++) {
      if (!hasConflict(seats, idx, remaining[j].groupId)) {
        const student = remaining.splice(j, 1)[0];
        seats[idx].rollNumber = student.roll;
        seats[idx].groupId = student.groupId;
        seats[idx].color = student.color;
        seats[idx].hex = student.hex;
        placed = true;
        break;
      }
    }
    if (!placed && remaining.length > 0) {
      // Place anyway, fix in phase 3
      const student = remaining.shift()!;
      seats[idx].rollNumber = student.roll;
      seats[idx].groupId = student.groupId;
      seats[idx].color = student.color;
      seats[idx].hex = student.hex;
    }
  }

  // Phase 3 — Conflict resolution (max 100 iterations)
  for (let iter = 0; iter < 100; iter++) {
    let swapped = false;
    for (let i = 0; i < seats.length; i++) {
      if (!seats[i].groupId) continue;
      if (!hasConflict(seats, i, seats[i].groupId!)) continue;

      // Find a swap candidate
      for (let j = 0; j < seats.length; j++) {
        if (i === j || !seats[j].groupId || seats[j].groupId === seats[i].groupId) continue;
        // Check if swapping resolves both
        const gi = seats[i].groupId!, gj = seats[j].groupId!;
        // Temporarily swap
        const tempRoll = seats[i].rollNumber;
        const tempGroup = seats[i].groupId;
        const tempColor = seats[i].color;
        const tempHex = seats[i].hex;

        seats[i].rollNumber = seats[j].rollNumber;
        seats[i].groupId = seats[j].groupId;
        seats[i].color = seats[j].color;
        seats[i].hex = seats[j].hex;

        seats[j].rollNumber = tempRoll;
        seats[j].groupId = tempGroup;
        seats[j].color = tempColor;
        seats[j].hex = tempHex;

        const iOk = !hasConflict(seats, i, seats[i].groupId!);
        const jOk = !hasConflict(seats, j, seats[j].groupId!);

        if (iOk && jOk) {
          swapped = true;
          break;
        } else {
          // Revert
          seats[j].rollNumber = seats[i].rollNumber;
          seats[j].groupId = seats[i].groupId;
          seats[j].color = seats[i].color;
          seats[j].hex = seats[i].hex;

          seats[i].rollNumber = tempRoll;
          seats[i].groupId = tempGroup;
          seats[i].color = tempColor;
          seats[i].hex = tempHex;
        }
      }
    }
    if (!swapped) break;
  }

  // Phase 4 — Count remaining conflicts
  let conflictCount = 0;
  for (let i = 0; i < seats.length; i++) {
    if (seats[i].groupId && hasConflict(seats, i, seats[i].groupId!)) {
      conflictCount++;
    }
  }

  return { seats, overflow, conflictCount };
}

// Get conflict seat indices
export function getConflictIndices(seats: Seat[]): Set<number> {
  const conflicts = new Set<number>();
  for (let i = 0; i < seats.length; i++) {
    if (seats[i].groupId && hasConflict(seats, i, seats[i].groupId!)) {
      conflicts.add(i);
    }
  }
  return conflicts;
}
