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

// Natural sort comparator — handles alphanumeric correctly (e.g. 25CS9 < 25CS10)
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
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

// Calculate total capacity
// (already exported above)

// Distribute students across columns proportionally
function distributeToColumns(pool: { roll: string; groupId: string; color: string; hex: string }[], layout: RoomLayout): { roll: string; groupId: string; color: string; hex: string }[][] {
  const capacities = layout.columns.map(col => col.subColumns * col.rows);
  const totalCapacity = capacities.reduce((a, b) => a + b, 0);
  const totalStudents = pool.length;

  const counts = capacities.map(cap => Math.floor(totalStudents * (cap / totalCapacity)));
  // Give all remaining students to the last column
  const assigned = counts.reduce((a, b) => a + b, 0);
  counts[counts.length - 1] += totalStudents - assigned;

  const result: typeof pool[] = [];
  let offset = 0;
  for (const count of counts) {
    result.push(pool.slice(offset, offset + count));
    offset += count;
  }
  return result;
}

// Step C — Normal Shuffle
export function normalShuffle(groups: Group[], layout: RoomLayout): { seats: Seat[]; overflow: string[] } {
  const seats = createEmptyGrid(layout);
  const numGroups = groups.length;
  if (numGroups === 0) return { seats, overflow: [] };

  // Build interleaved pool
  const maxLen = Math.max(...groups.map(g => g.members.length));
  const pool: { roll: string; groupId: string; color: string; hex: string }[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.members.length) {
        pool.push({ roll: g.members[i], groupId: g.id, color: g.color, hex: g.hex });
      }
    }
  }

  const capacity = seats.length;
  const overflow = pool.slice(capacity).map(p => p.roll);
  const toPlace = pool.slice(0, capacity);

  // Distribute across columns proportionally
  const columnPools = distributeToColumns(toPlace, layout);

  // Fill each column: assign subCol to a group, fill top-to-bottom
  let seatIdx = 0;
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c];
    const colPool = columnPools[c];

    // Split column pool back into per-group queues
    const groupQueues = new Map<string, typeof colPool>();
    for (const g of groups) groupQueues.set(g.id, []);
    for (const s of colPool) {
      groupQueues.get(s.groupId)?.push(s);
    }

    for (let sc = 0; sc < col.subColumns; sc++) {
      const assignedGroupIdx = sc % numGroups;
      const assignedGroup = groups[assignedGroupIdx];
      const queue = groupQueues.get(assignedGroup.id)!;

      for (let r = 0; r < col.rows; r++) {
        const idx = seatIdx + r * col.subColumns + sc;
        if (queue.length > 0) {
          const student = queue.shift()!;
          seats[idx].rollNumber = student.roll;
          seats[idx].groupId = student.groupId;
          seats[idx].color = student.color;
          seats[idx].hex = student.hex;
        }
      }
    }

    // Place any remaining students from other groups into empty seats
    const remaining: typeof colPool = [];
    for (const q of groupQueues.values()) remaining.push(...q);
    if (remaining.length > 0) {
      for (let r = 0; r < col.rows; r++) {
        for (let sc = 0; sc < col.subColumns; sc++) {
          const idx = seatIdx + r * col.subColumns + sc;
          if (!seats[idx].rollNumber && remaining.length > 0) {
            const student = remaining.shift()!;
            seats[idx].rollNumber = student.roll;
            seats[idx].groupId = student.groupId;
            seats[idx].color = student.color;
            seats[idx].hex = student.hex;
          }
        }
      }
    }

    seatIdx += col.subColumns * col.rows;
  }

  return { seats, overflow };
}

// Check full-row conflict: no two same-group students in the same row within a column
function hasRowConflict(seats: Seat[], layout: RoomLayout, idx: number, groupId: string): boolean {
  const seat = seats[idx];
  // Find the start index of this column
  let colStart = 0;
  let col: ColumnConfig | null = null;
  for (let c = 0; c < layout.columns.length; c++) {
    const size = layout.columns[c].subColumns * layout.columns[c].rows;
    if (idx < colStart + size) {
      col = layout.columns[c];
      break;
    }
    colStart += size;
  }
  if (!col) return false;

  const localIdx = idx - colStart;
  const row = Math.floor(localIdx / col.subColumns);

  // Check all other seats in the same row
  for (let sc = 0; sc < col.subColumns; sc++) {
    const otherIdx = colStart + row * col.subColumns + sc;
    if (otherIdx === idx) continue;
    if (seats[otherIdx].groupId === groupId) return true;
  }

  // Check vertical neighbors (top and bottom in same subCol)
  const subCol = localIdx % col.subColumns;
  if (row > 0) {
    const topIdx = colStart + (row - 1) * col.subColumns + subCol;
    if (seats[topIdx].groupId === groupId) return true;
  }
  if (row < col.rows - 1) {
    const bottomIdx = colStart + (row + 1) * col.subColumns + subCol;
    if (seats[bottomIdx].groupId === groupId) return true;
  }

  return false;
}

// Step D — University Shuffle
export function universityShuffle(groups: Group[], layout: RoomLayout): { seats: Seat[]; overflow: string[]; conflictCount: number } {
  const seats = createEmptyGrid(layout);
  const numGroups = groups.length;

  if (numGroups <= 1) {
    const result = normalShuffle(groups, layout);
    return { ...result, conflictCount: 0 };
  }

  // Build interleaved pool
  const maxLen = Math.max(...groups.map(g => g.members.length));
  const pool: { roll: string; groupId: string; color: string; hex: string }[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.members.length) {
        pool.push({ roll: g.members[i], groupId: g.id, color: g.color, hex: g.hex });
      }
    }
  }

  const capacity = seats.length;
  const overflow = pool.slice(capacity).map(p => p.roll);
  const toPlace = pool.slice(0, capacity);

  // Distribute across columns proportionally
  const columnPools = distributeToColumns(toPlace, layout);

  // Fill each column using row-offset rotation
  let seatIdx = 0;
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c];
    const colPool = columnPools[c];

    // Split into per-group queues
    const groupQueues = new Map<string, typeof colPool>();
    for (const g of groups) groupQueues.set(g.id, []);
    for (const s of colPool) {
      groupQueues.get(s.groupId)?.push(s);
    }

    for (let r = 0; r < col.rows; r++) {
      const startGroup = r % numGroups;
      for (let sc = 0; sc < col.subColumns; sc++) {
        const targetGroupIdx = (startGroup + sc) % numGroups;
        const targetGroup = groups[targetGroupIdx];
        const queue = groupQueues.get(targetGroup.id)!;
        const idx = seatIdx + r * col.subColumns + sc;

        if (queue.length > 0) {
          const student = queue.shift()!;
          seats[idx].rollNumber = student.roll;
          seats[idx].groupId = student.groupId;
          seats[idx].color = student.color;
          seats[idx].hex = student.hex;
        } else {
          // Fallback: find any group with remaining students
          let placed = false;
          for (let g = 0; g < numGroups; g++) {
            const fallbackIdx = (targetGroupIdx + g) % numGroups;
            const fallbackQueue = groupQueues.get(groups[fallbackIdx].id)!;
            if (fallbackQueue.length > 0) {
              const student = fallbackQueue.shift()!;
              seats[idx].rollNumber = student.roll;
              seats[idx].groupId = student.groupId;
              seats[idx].color = student.color;
              seats[idx].hex = student.hex;
              placed = true;
              break;
            }
          }
        }
      }
    }

    seatIdx += col.subColumns * col.rows;
  }

  // Count conflicts using full-row check
  let conflictCount = 0;
  for (let i = 0; i < seats.length; i++) {
    if (seats[i].groupId && hasRowConflict(seats, layout, i, seats[i].groupId!)) {
      conflictCount++;
    }
  }

  return { seats, overflow, conflictCount };
}

// Get conflict seat indices (uses full-row conflict check)
export function getConflictIndices(seats: Seat[], layout?: RoomLayout): Set<number> {
  const conflicts = new Set<number>();
  if (!layout) return conflicts;
  for (let i = 0; i < seats.length; i++) {
    if (seats[i].groupId && hasRowConflict(seats, layout, i, seats[i].groupId!)) {
      conflicts.add(i);
    }
  }
  return conflicts;
}
