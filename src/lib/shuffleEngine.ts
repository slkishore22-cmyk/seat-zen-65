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
  if (!raw || raw.trim() === '') return [];

  // Step 1: Split by standard delimiters
  const tokens = raw
    .split(/[\s,;\n\r\t]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // Step 2: Smart unjam pass
  // Detect pure-number tokens that are multiple roll numbers jammed together
  const unjammed: string[] = [];
  for (const token of tokens) {
    const isPureNumber = /^\d+$/.test(token);
    if (isPureNumber && token.length > 7) {
      let chunkSize = 7;
      if (token.length % 7 === 0) {
        chunkSize = 7;
      } else if (token.length % 6 === 0) {
        chunkSize = 6;
      } else if (token.length % 5 === 0) {
        chunkSize = 5;
      } else {
        chunkSize = 7;
      }
      for (let i = 0; i < token.length; i += chunkSize) {
        const chunk = token.substring(i, i + chunkSize);
        if (chunk.length > 0) {
          unjammed.push(chunk);
        }
      }
    } else {
      unjammed.push(token);
    }
  }

  // Step 3: Deduplicate while preserving first-seen order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of unjammed) {
    const upper = token.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      unique.push(upper);
    }
  }

  return unique;
}

// Natural sort comparator — handles alphanumeric correctly (e.g. 25CS9 < 25CS10)
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Step B — Auto Grouper
function extractPrefix(rollNumber: string): string {
  const upper = rollNumber.toUpperCase().trim();

  // PATTERN 1: Alphanumeric with year+letters+number (e.g. 25CS001, 24A001)
  const alphaNumPrefix = upper.match(/^([A-Z]*\d+[A-Z]+)/);
  if (alphaNumPrefix) return alphaNumPrefix[1];

  // PATTERN 2: Letters only prefix before digits (e.g. CS001, ME010)
  const lettersFirst = upper.match(/^([A-Z]+)/);
  if (lettersFirst) return lettersFirst[1];

  // PATTERN 3: Pure numeric roll numbers (e.g. 23456, 24001)
  const pureNumber = upper.match(/^(\d+)$/);
  if (pureNumber) {
    const numStr = pureNumber[1];
    const num = parseInt(numStr, 10);

    if (numStr.length >= 4) {
      return numStr.substring(0, 2); // first 2 digits = year batch
    }
    if (numStr.length === 3) {
      return numStr.substring(0, 1); // first 1 digit = group
    }
    if (num >= 100) {
      return numStr.substring(0, 2);
    }
    // 1-2 digit numbers: group by tens
    const tensGroup = Math.floor(num / 10) * 10;
    return tensGroup === 0 ? '1' : String(tensGroup);
  }

  return upper.substring(0, 3);
}

export function autoGroup(rollNumbers: string[]): Group[] {
  const groups = new Map<string, string[]>();

  for (const rn of rollNumbers) {
    const prefix = extractPrefix(rn);
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

// Extract numeric suffix from a roll number
export function extractNumericSuffix(roll: string): number {
  const upper = roll.toUpperCase().trim();

  // Pure numeric 4+ digits: use last 3 digits as suffix
  const pureNumber = upper.match(/^(\d+)$/);
  if (pureNumber) {
    const numStr = pureNumber[1];
    if (numStr.length >= 4) {
      return parseInt(numStr.slice(-3), 10);
    }
    return parseInt(numStr, 10);
  }

  // Alphanumeric: extract trailing digits
  const match = roll.match(/(\d+)\s*(\([^)]*\))?$/);
  if (match) return parseInt(match[1], 10);

  return 0;
}

// Detect sequence gaps within a group's sorted members
export function detectSequenceGaps(members: string[]): { missing: number[]; ranges: string } {
  if (members.length === 0) return { missing: [], ranges: "" };
  const nums = members.map(extractNumericSuffix).sort((a, b) => a - b);
  const missing: number[] = [];
  for (let i = 1; i < nums.length; i++) {
    for (let n = nums[i - 1] + 1; n < nums[i]; n++) {
      missing.push(n);
    }
  }
  // Build range string
  const ranges: string[] = [];
  let start = nums[0];
  let end = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === end + 1) {
      end = nums[i];
    } else {
      ranges.push(start === end ? String(start).padStart(3, '0') : `${String(start).padStart(3, '0')} → ${String(end).padStart(3, '0')}`);
      start = nums[i];
      end = nums[i];
    }
  }
  ranges.push(start === end ? String(start).padStart(3, '0') : `${String(start).padStart(3, '0')} → ${String(end).padStart(3, '0')}`);
  return { missing, ranges: ranges.join(', ') };
}

// Get the sub-column to group assignment for normal shuffle
export function getSubColGroupAssignment(layout: RoomLayout, groups: Group[]): { columnIndex: number; subColIndex: number; group: Group | null }[] {
  const assignments: { columnIndex: number; subColIndex: number; group: Group | null }[] = [];
  if (groups.length === 0) return assignments;
  let globalSubCol = 0;
  for (let c = 0; c < layout.columns.length; c++) {
    for (let sc = 0; sc < layout.columns[c].subColumns; sc++) {
      const groupIdx = globalSubCol % groups.length;
      assignments.push({ columnIndex: c, subColIndex: sc, group: groups[groupIdx] });
      globalSubCol++;
    }
  }
  return assignments;
}

// Helper: get horizontal and vertical neighbors' groupIds for a seat index
function getNeighborGroupIds(seats: Seat[], layout: RoomLayout, idx: number): Set<string> {
  const neighbors = new Set<string>();
  // Find which column this seat belongs to
  let colStart = 0;
  let col: ColumnConfig | null = null;
  let colIdx = -1;
  for (let c = 0; c < layout.columns.length; c++) {
    const size = layout.columns[c].subColumns * layout.columns[c].rows;
    if (idx < colStart + size) {
      col = layout.columns[c];
      colIdx = c;
      break;
    }
    colStart += size;
  }
  if (!col) return neighbors;

  const localIdx = idx - colStart;
  const row = Math.floor(localIdx / col.subColumns);
  const sc = localIdx % col.subColumns;

  // Left neighbor
  if (sc > 0) {
    const leftIdx = colStart + row * col.subColumns + (sc - 1);
    if (seats[leftIdx].groupId) neighbors.add(seats[leftIdx].groupId!);
  }
  // Right neighbor
  if (sc < col.subColumns - 1) {
    const rightIdx = colStart + row * col.subColumns + (sc + 1);
    if (seats[rightIdx].groupId) neighbors.add(seats[rightIdx].groupId!);
  }
  // Top neighbor
  if (row > 0) {
    const topIdx = colStart + (row - 1) * col.subColumns + sc;
    if (seats[topIdx].groupId) neighbors.add(seats[topIdx].groupId!);
  }
  // Bottom neighbor
  if (row < col.rows - 1) {
    const bottomIdx = colStart + (row + 1) * col.subColumns + sc;
    if (seats[bottomIdx].groupId) neighbors.add(seats[bottomIdx].groupId!);
  }

  return neighbors;
}

// Step C — Normal Shuffle
// Each sub-column is PERMANENTLY assigned to one department (wrapping).
// Students fill vertically top-to-bottom via queue.shift() — pure sequential drain.
// Missing roll numbers are never in the queue, so no seat is ever left empty for them.
// Overflow pass fills remaining empty seats respecting no-horizontal-same-dept constraint.
export function normalShuffle(groups: Group[], layout: RoomLayout): { seats: Seat[]; overflow: string[] } {
  const seats = createEmptyGrid(layout);
  if (groups.length === 0) return { seats, overflow: [] };

  const numGroups = groups.length;

  // STEP 1: Build sorted queues — only real students, no placeholders
  const sortedGroups = groups.map(g => ({
    ...g,
    members: [...g.members].sort((a, b) => extractNumericSuffix(a) - extractNumericSuffix(b)),
  }));

  // Each group gets its own queue of real students only
  const groupQueues: string[][] = sortedGroups.map(g => [...g.members]);

  // STEP 2 + 3: Fill each sub-column top-to-bottom with its permanently assigned group
  // Assignment: globalSubCol % numGroups — NEVER changes, NEVER mixes departments
  let seatIdx = 0;
  let globalSubCol = 0;

  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c];
    for (let sc = 0; sc < col.subColumns; sc++) {
      const groupIdx = globalSubCol % numGroups; // permanent assignment
      const group = sortedGroups[groupIdx];
      const queue = groupQueues[groupIdx];

      // Fill this sub-column top to bottom — pure sequential drain
      for (let r = 0; r < col.rows; r++) {
        const idx = seatIdx + r * col.subColumns + sc;
        if (queue.length > 0) {
          const roll = queue.shift()!; // next real student, never skip
          seats[idx].rollNumber = roll;
          seats[idx].groupId = group.id;
          seats[idx].color = group.color;
          seats[idx].hex = group.hex;
        }
        // else: seat stays empty — this group is truly exhausted
      }
      globalSubCol++;
    }
    seatIdx += col.subColumns * col.rows;
  }

  // STEP 4: Overflow pass — fill remaining empty seats with leftover students
  const remaining: { roll: string; group: typeof sortedGroups[0] }[] = [];
  for (let gi = 0; gi < numGroups; gi++) {
    const queue = groupQueues[gi];
    for (const roll of queue) {
      remaining.push({ roll, group: sortedGroups[gi] });
    }
    queue.length = 0;
  }

  if (remaining.length > 0) {
    const emptyIndices: number[] = [];
    for (let i = 0; i < seats.length; i++) {
      if (!seats[i].rollNumber) emptyIndices.push(i);
    }

    for (const emptyIdx of emptyIndices) {
      if (remaining.length === 0) break;

      // Get ONLY horizontal neighbors (left and right in same row)
      const neighborGroupIds = new Set<string>();
      let colStart = 0;
      let col: ColumnConfig | null = null;
      for (let ci = 0; ci < layout.columns.length; ci++) {
        const size = layout.columns[ci].subColumns * layout.columns[ci].rows;
        if (emptyIdx < colStart + size) {
          col = layout.columns[ci];
          break;
        }
        colStart += size;
      }
      if (col) {
        const localIdx = emptyIdx - colStart;
        const row = Math.floor(localIdx / col.subColumns);
        const sc = localIdx % col.subColumns;
        // Left neighbor
        if (sc > 0) {
          const leftIdx = colStart + row * col.subColumns + (sc - 1);
          if (seats[leftIdx].groupId) neighborGroupIds.add(seats[leftIdx].groupId!);
        }
        // Right neighbor
        if (sc < col.subColumns - 1) {
          const rightIdx = colStart + row * col.subColumns + (sc + 1);
          if (seats[rightIdx].groupId) neighborGroupIds.add(seats[rightIdx].groupId!);
        }
      }

      // Find first student that doesn't conflict horizontally
      let bestIdx = -1;
      for (let i = 0; i < remaining.length; i++) {
        if (!neighborGroupIds.has(remaining[i].group.id)) {
          bestIdx = i;
          break;
        }
      }

      // No conflict-free student available — place next anyway (no empty seats)
      if (bestIdx === -1) bestIdx = 0;

      const student = remaining.splice(bestIdx, 1)[0];
      seats[emptyIdx].rollNumber = student.roll;
      seats[emptyIdx].groupId = student.group.id;
      seats[emptyIdx].color = student.group.color;
      seats[emptyIdx].hex = student.group.hex;
    }
  }

  const overflow = remaining.map(r => r.roll);
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

// ==========================================
// MULTI-ROOM DISTRIBUTION
// ==========================================

export interface RoomConfig {
  index: number;
  name: string;
  columns: ColumnConfig[];
}

export interface RoomResult {
  roomIndex: number;
  roomName: string;
  groups: Group[];
  seats: Seat[];
  overflow: string[];
  conflictCount: number;
  studentCount: number;
}

export function distributeStudentsAcrossRooms(
  groups: Group[],
  rooms: RoomConfig[],
  shuffleType: "normal" | "university"
): RoomResult[] {
  if (rooms.length === 0 || groups.length === 0) return [];

  // Sort each group's members
  const sortedGroups = groups.map(g => ({
    ...g,
    members: [...g.members].sort((a, b) => extractNumericSuffix(a) - extractNumericSuffix(b)),
  }));

  // Calculate capacities
  const roomCapacities = rooms.map(r =>
    r.columns.reduce((sum, col) => sum + col.subColumns * col.rows, 0)
  );
  const totalCapacity = roomCapacities.reduce((a, b) => a + b, 0);

  // For each group, split members proportionally across rooms
  const roomGroupSlices: Map<number, Map<string, string[]>> = new Map();
  for (let ri = 0; ri < rooms.length; ri++) {
    roomGroupSlices.set(ri, new Map());
  }

  for (const group of sortedGroups) {
    const members = group.members;
    let offset = 0;

    for (let ri = 0; ri < rooms.length; ri++) {
      let count: number;
      if (ri === rooms.length - 1) {
        // Last room gets remainder
        count = members.length - offset;
      } else {
        count = totalCapacity > 0
          ? Math.floor(members.length * (roomCapacities[ri] / totalCapacity))
          : 0;
      }
      count = Math.max(0, Math.min(count, members.length - offset));
      roomGroupSlices.get(ri)!.set(group.id, members.slice(offset, offset + count));
      offset += count;
    }
  }

  // Build per-room Group[] and run shuffle
  const results: RoomResult[] = [];

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    const layout: RoomLayout = { columns: room.columns };
    const slices = roomGroupSlices.get(ri)!;

    // Build groups for this room (exclude empty groups)
    const roomGroups: Group[] = [];
    for (const group of sortedGroups) {
      const slice = slices.get(group.id) || [];
      if (slice.length > 0) {
        roomGroups.push({ ...group, members: slice });
      }
    }

    let seats: Seat[];
    let overflow: string[];
    let conflictCount = 0;

    if (shuffleType === "normal") {
      const r = normalShuffle(roomGroups, layout);
      seats = r.seats;
      overflow = r.overflow;
    } else {
      const r = universityShuffle(roomGroups, layout);
      seats = r.seats;
      overflow = r.overflow;
      conflictCount = r.conflictCount;
    }

    results.push({
      roomIndex: ri,
      roomName: room.name || `Room ${ri + 1}`,
      groups: roomGroups,
      seats,
      overflow,
      conflictCount,
      studentCount: seats.filter(s => s.rollNumber).length,
    });
  }

  return results;
}
