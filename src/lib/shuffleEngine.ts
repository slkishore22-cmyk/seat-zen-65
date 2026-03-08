// ==========================================
// EXAM SEATING SHUFFLE ENGINE
// ==========================================

import { supabase } from "@/integrations/supabase/client";

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

  // PATTERN 3: Pure numeric roll numbers
  // Last 3 digits = student sequence number
  // Everything before last 3 = department/batch prefix
  // e.g. 2401001 → "2401", 2402001 → "2402", 2024147 → "2024", 23456 → "23"
  const pureNumber = upper.match(/^(\d+)$/);
  if (pureNumber) {
    const numStr = pureNumber[1];
    const num = parseInt(numStr, 10);

    if (numStr.length >= 4) {
      return numStr.substring(0, numStr.length - 3);
    }
    if (numStr.length === 3) {
      return numStr.substring(0, 1);
    }
    if (num >= 100) {
      return numStr.substring(0, 1);
    }
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
// getSubColGroupAssignment moved into normalShuffle section below

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

// ==========================================
// NORMAL SHUFFLE — Sub-column-based vertical fill
// ==========================================

export interface InterleaveInfo {
  departmentNames: string[];
  pattern: string;
  validated: boolean;
  failedAt: number | null;
  columnWarnings?: string[];
}

/**
 * Validate columns: check if any two consecutive students
 * in the same sub-column (vertically) are from the same department.
 */
export function validateColumns(seats: Seat[], layout: RoomLayout): string[] {
  const warnings: string[] = [];
  let seatOffset = 0;
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c];
    for (let sc = 0; sc < col.subColumns; sc++) {
      let prevGroupId: string | null = null;
      for (let r = 0; r < col.rows; r++) {
        const idx = seatOffset + r * col.subColumns + sc;
        const seat = seats[idx];
        if (seat?.rollNumber && seat.groupId) {
          if (prevGroupId && seat.groupId === prevGroupId) {
            warnings.push(`Department appears consecutively in Column ${c + 1}, Sub-col ${sc + 1}`);
          }
          prevGroupId = seat.groupId;
        } else {
          prevGroupId = null;
        }
      }
    }
    seatOffset += col.subColumns * col.rows;
  }
  return warnings;
}

/**
 * Get sub-column → department assignment for display labels.
 */
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

/**
 * NORMAL SHUFFLE — Complete rewrite.
 * 
 * THE LAW:
 *   - Each sub-column is PERMANENTLY assigned to one department (round-robin).
 *   - Fill each sub-column top-to-bottom with that department's sorted students.
 *   - Remaining students fill empty seats, preferring non-conflicting neighbors.
 *   - If no seats remain, expand the last column by adding rows until all students fit.
 */
export function normalShuffle(groups: Group[], layout: RoomLayout): { seats: Seat[]; interleaveInfo: InterleaveInfo } {
  const emptyInfo: InterleaveInfo = { departmentNames: [], pattern: "", validated: true, failedAt: null, columnWarnings: [] };
  if (groups.length === 0) {
    return { seats: createEmptyGrid(layout), interleaveInfo: emptyInfo };
  }

  const numGroups = groups.length;

  // STEP 1: Build sorted, deduplicated queues
  const globalSeen = new Set<string>();
  const queues: string[][] = groups.map(g => {
    const sorted = [...g.members].sort((a, b) => extractNumericSuffix(a) - extractNumericSuffix(b));
    const deduped: string[] = [];
    for (const roll of sorted) {
      if (!globalSeen.has(roll)) {
        globalSeen.add(roll);
        deduped.push(roll);
      }
    }
    return deduped;
  });

  // Count total students
  const totalStudents = queues.reduce((sum, q) => sum + q.length, 0);
  const currentCapacity = getTotalCapacity(layout);

  // Auto-expand last column if needed
  const effectiveLayout: RoomLayout = { columns: layout.columns.map(c => ({ ...c })) };
  if (totalStudents > currentCapacity) {
    const lastCol = effectiveLayout.columns[effectiveLayout.columns.length - 1];
    const deficit = totalStudents - currentCapacity;
    const extraRows = Math.ceil(deficit / lastCol.subColumns);
    lastCol.rows += extraRows;
  }

  const seats = createEmptyGrid(effectiveLayout);

  // STEP 2 + 3: Permanent sub-column assignment + vertical fill
  const gridRef: number[][][] = [];
  let seatOffset = 0;
  for (let c = 0; c < effectiveLayout.columns.length; c++) {
    const col = effectiveLayout.columns[c];
    gridRef[c] = [];
    for (let r = 0; r < col.rows; r++) {
      gridRef[c][r] = [];
      for (let sc = 0; sc < col.subColumns; sc++) {
        gridRef[c][r][sc] = seatOffset + r * col.subColumns + sc;
      }
    }
    seatOffset += col.subColumns * col.rows;
  }

  // Fill each sub-column top to bottom
  for (let c = 0; c < effectiveLayout.columns.length; c++) {
    const col = effectiveLayout.columns[c];
    for (let sc = 0; sc < col.subColumns; sc++) {
      let globalSc = sc;
      for (let pc = 0; pc < c; pc++) {
        globalSc += effectiveLayout.columns[pc].subColumns;
      }
      const gi = globalSc % numGroups;
      const queue = queues[gi];
      const group = groups[gi];

      for (let r = 0; r < col.rows; r++) {
        const idx = gridRef[c][r][sc];
        if (queue.length > 0) {
          const roll = queue.shift()!;
          seats[idx].rollNumber = roll;
          seats[idx].groupId = group.id;
          seats[idx].color = group.color;
          seats[idx].hex = group.hex;
        }
      }
    }
  }

  // STEP 3: Collect remaining students
  const remaining_pool: { roll: string; gi: number }[] = [];
  for (let g = 0; g < numGroups; g++) {
    while (queues[g].length > 0) {
      remaining_pool.push({ roll: queues[g].shift()!, gi: g });
    }
  }

  // STEP 4: Place remaining students into empty seats with priority system
  if (remaining_pool.length > 0) {
    for (let c = 0; c < effectiveLayout.columns.length; c++) {
      const col = effectiveLayout.columns[c];
      const subCols = col.subColumns;
      for (let sc = 0; sc < subCols; sc++) {
        for (let r = 0; r < col.rows; r++) {
          const idx = gridRef[c][r][sc];
          if (seats[idx].rollNumber) continue;
          if (remaining_pool.length === 0) continue;

          const rowGroupSet = new Set<string>();
          for (let s = 0; s < subCols; s++) {
            const seatInRow = seats[gridRef[c][r][s]];
            if (seatInRow.rollNumber && seatInRow.groupId) {
              rowGroupSet.add(seatInRow.groupId);
            }
          }

          const leftGid = sc > 0 && seats[gridRef[c][r][sc - 1]].rollNumber
            ? seats[gridRef[c][r][sc - 1]].groupId : null;
          const rightGid = sc < subCols - 1 && seats[gridRef[c][r][sc + 1]].rollNumber
            ? seats[gridRef[c][r][sc + 1]].groupId : null;

          let best = -1;

          // PRIORITY 1: Not in row AND not adjacent to neighbors
          for (let i = 0; i < remaining_pool.length; i++) {
            const gid = groups[remaining_pool[i].gi].id;
            if (!rowGroupSet.has(gid) && gid !== leftGid && gid !== rightGid) {
              best = i; break;
            }
          }

          // PRIORITY 2: Not in row
          if (best === -1) {
            for (let i = 0; i < remaining_pool.length; i++) {
              const gid = groups[remaining_pool[i].gi].id;
              if (!rowGroupSet.has(gid)) { best = i; break; }
            }
          }

          // PRIORITY 3: Not adjacent to immediate neighbors
          if (best === -1) {
            for (let i = 0; i < remaining_pool.length; i++) {
              const gid = groups[remaining_pool[i].gi].id;
              if (gid !== leftGid && gid !== rightGid) { best = i; break; }
            }
          }

          // PRIORITY 4: Least represented dept in this row
          if (best === -1) {
            const rowCnt: Record<string, number> = {};
            for (let s = 0; s < subCols; s++) {
              const seatInRow = seats[gridRef[c][r][s]];
              if (seatInRow.rollNumber && seatInRow.groupId) {
                rowCnt[seatInRow.groupId] = (rowCnt[seatInRow.groupId] || 0) + 1;
              }
            }
            let minCnt = Infinity;
            for (let i = 0; i < remaining_pool.length; i++) {
              const gid = groups[remaining_pool[i].gi].id;
              const cnt = rowCnt[gid] || 0;
              if (cnt < minCnt) { minCnt = cnt; best = i; }
            }
          }

          // ABSOLUTE FALLBACK
          if (best === -1) best = 0;

          const student = remaining_pool.splice(best, 1)[0];
          const group = groups[student.gi];
          seats[idx].rollNumber = student.roll;
          seats[idx].groupId = group.id;
          seats[idx].color = group.color;
          seats[idx].hex = group.hex;
        }
      }
    }
  }

  const pattern = groups.map((_, i) => i + 1).join("-");

  return {
    seats,
    interleaveInfo: {
      departmentNames: groups.map(g => g.label),
      pattern,
      validated: true,
      failedAt: null,
      columnWarnings: [],
    },
  };
}

// ==========================================
// AI POST-PROCESSING — Fix horizontal conflicts
// ==========================================

/** Find horizontal same-department conflicts with position info */
function findHorizontalConflictsWithPositions(seats: Seat[], layout: RoomLayout): { indices: number[]; positions: string[] } {
  const indices: number[] = [];
  const positions: string[] = [];
  let seatOffset = 0;
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c];
    for (let r = 0; r < col.rows; r++) {
      for (let sc = 0; sc < col.subColumns - 1; sc++) {
        const idx = seatOffset + r * col.subColumns + sc;
        const nextIdx = seatOffset + r * col.subColumns + sc + 1;
        if (seats[idx].groupId && seats[nextIdx].groupId && seats[idx].groupId === seats[nextIdx].groupId) {
          if (!indices.includes(idx)) {
            indices.push(idx);
            positions.push(`col${c},row${r},sc${sc}`);
          }
          if (!indices.includes(nextIdx)) {
            indices.push(nextIdx);
            positions.push(`col${c},row${r},sc${sc + 1}`);
          }
        }
      }
    }
    seatOffset += col.subColumns * col.rows;
  }
  return { indices, positions };
}

/**
 * AI post-processing: fix horizontal same-dept conflicts.
 * Called after normalShuffle() finishes.
 * Returns the AI-fixed grid, or the original if AI fails validation.
 */
export async function fixConflictsWithAI(
  seats: Seat[],
  layout: RoomLayout,
  groups: Group[]
): Promise<Seat[]> {
  const { indices: conflicts, positions } = findHorizontalConflictsWithPositions(seats, layout);
  if (conflicts.length === 0) return seats;

  // Count original filled seats and collect rollNumbers
  const originalRolls = new Set<string>();
  let originalFilledCount = 0;
  for (const s of seats) {
    if (s.rollNumber) {
      originalFilledCount++;
      originalRolls.add(s.rollNumber);
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke("ai-fix-conflicts", {
      body: {
        grid: seats,
        layout,
        groups,
        conflicts,
        conflictPositions: positions,
        totalStudents: originalFilledCount,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    if (data?.fixedGrid && Array.isArray(data.fixedGrid)) {
      const fixedGrid: Seat[] = data.fixedGrid;

      // VALIDATION 1: Count must match
      let fixedFilledCount = 0;
      const fixedRolls = new Set<string>();
      for (const s of fixedGrid) {
        if (s.rollNumber) {
          fixedFilledCount++;
          if (fixedRolls.has(s.rollNumber)) {
            console.warn("AI response has duplicate rollNumber:", s.rollNumber);
            return seats; // Discard
          }
          fixedRolls.add(s.rollNumber);
        }
      }

      if (fixedFilledCount !== originalFilledCount) {
        console.warn(`AI response seat count mismatch: original=${originalFilledCount}, fixed=${fixedFilledCount}`);
        return seats; // Discard
      }

      // VALIDATION 2: Every original rollNumber must exist
      for (const roll of originalRolls) {
        if (!fixedRolls.has(roll)) {
          console.warn("AI response missing rollNumber:", roll);
          return seats; // Discard
        }
      }

      // VALIDATION 3: No new rollNumbers
      for (const roll of fixedRolls) {
        if (!originalRolls.has(roll)) {
          console.warn("AI response has unknown rollNumber:", roll);
          return seats; // Discard
        }
      }

      // All checks passed — apply the fixed grid
      // Restore seat position metadata from original (AI only moves student data)
      const result = seats.map((original, i) => {
        const fixed = fixedGrid[i];
        if (!fixed) return original;
        return {
          ...original,
          rollNumber: fixed.rollNumber,
          groupId: fixed.groupId,
          color: fixed.color,
          hex: fixed.hex,
        };
      });

      return result;
    }

    return seats;
  } catch (e) {
    console.warn("AI post-processing failed, using rule-based result:", e);
    return seats;
  }
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
export function universityShuffle(groups: Group[], layout: RoomLayout): { seats: Seat[]; conflictCount: number } {
  const numGroups = groups.length;

  if (numGroups <= 1) {
    const result = normalShuffle(groups, layout);
    return { seats: result.seats, conflictCount: 0 };
  }

  // Count total students and auto-expand if needed
  const totalStudents = groups.reduce((sum, g) => sum + g.members.length, 0);
  const currentCapacity = getTotalCapacity(layout);
  const effectiveLayout: RoomLayout = { columns: layout.columns.map(c => ({ ...c })) };
  if (totalStudents > currentCapacity) {
    const lastCol = effectiveLayout.columns[effectiveLayout.columns.length - 1];
    const deficit = totalStudents - currentCapacity;
    const extraRows = Math.ceil(deficit / lastCol.subColumns);
    lastCol.rows += extraRows;
  }

  const seats = createEmptyGrid(effectiveLayout);

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

  const toPlace = pool;

  // Distribute across columns proportionally
  const columnPools = distributeToColumns(toPlace, effectiveLayout);

  // Fill each column using row-offset rotation
  let seatIdx = 0;
  for (let c = 0; c < effectiveLayout.columns.length; c++) {
    const col = effectiveLayout.columns[c];
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
          for (let g = 0; g < numGroups; g++) {
            const fallbackIdx = (targetGroupIdx + g) % numGroups;
            const fallbackQueue = groupQueues.get(groups[fallbackIdx].id)!;
            if (fallbackQueue.length > 0) {
              const student = fallbackQueue.shift()!;
              seats[idx].rollNumber = student.roll;
              seats[idx].groupId = student.groupId;
              seats[idx].color = student.color;
              seats[idx].hex = student.hex;
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

  return { seats, conflictCount };
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
  seats: Seat[];
  conflictCount: number;
  studentCount: number;
  interleaveInfo?: InterleaveInfo;
}

export async function distributeStudentsAcrossRooms(
  groups: Group[],
  rooms: RoomConfig[],
  shuffleType: "normal" | "university"
): Promise<RoomResult[]> {
  if (rooms.length === 0 || groups.length === 0) return [];

  // STEP 1: Calculate each room's seat capacity
  const roomCapacities = rooms.map(r =>
    r.columns.reduce((sum, col) => sum + col.subColumns * col.rows, 0)
  );
  const totalCapacity = roomCapacities.reduce((s, c) => s + c, 0);

  // STEP 2: Sort each group's members by numeric suffix
  const sortedGroups = groups.map(g => ({
    ...g,
    members: [...g.members].sort(
      (a, b) => extractNumericSuffix(a) - extractNumericSuffix(b)
    ),
  }));

  // STEP 3: For each group, distribute members across rooms
  // using LARGEST REMAINDER METHOD to prevent any student from being dropped
  const roomGroupSlices: Map<number, Map<string, string[]>> = new Map();
  for (let ri = 0; ri < rooms.length; ri++) {
    roomGroupSlices.set(ri, new Map());
  }

  for (const group of sortedGroups) {
    const members = group.members;
    const n = members.length;
    if (n === 0) continue;

    // Calculate exact (fractional) allocation per room
    const exactCounts = rooms.map((_, i) =>
      totalCapacity > 0 ? n * (roomCapacities[i] / totalCapacity) : 0
    );

    // Floor all counts first
    const floorCounts = exactCounts.map(c => Math.floor(c));
    let assigned = floorCounts.reduce((s, c) => s + c, 0);
    let remainder = n - assigned;

    // Distribute remainder students using largest remainder method
    if (remainder > 0) {
      const fractionalParts = exactCounts.map((exact, i) => ({
        i,
        frac: exact - floorCounts[i],
      }));
      fractionalParts.sort((a, b) => b.frac - a.frac);
      for (let k = 0; k < remainder && k < fractionalParts.length; k++) {
        floorCounts[fractionalParts[k].i]++;
      }
    }

    // VERIFY: all students accounted for
    const totalAssigned = floorCounts.reduce((s, c) => s + c, 0);
    if (totalAssigned !== n) {
      const diff = n - totalAssigned;
      const maxCapRoom = roomCapacities.indexOf(Math.max(...roomCapacities));
      floorCounts[maxCapRoom] += diff;
    }

    // STEP 4: Slice the sorted members array for each room
    let offset = 0;
    for (let ri = 0; ri < rooms.length; ri++) {
      const count = floorCounts[ri];
      const slice = members.slice(offset, offset + count);
      offset += count;
      roomGroupSlices.get(ri)!.set(group.id, slice);
    }

    // Safety: if any students left behind, add to last room
    if (offset < n) {
      const remaining = members.slice(offset);
      const lastSlices = roomGroupSlices.get(rooms.length - 1)!;
      const existing = lastSlices.get(group.id) || [];
      lastSlices.set(group.id, [...existing, ...remaining]);
    }
  }

  // STEP 5: Build per-room Group[] and run shuffle
  const results: RoomResult[] = [];

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    const layout: RoomLayout = { columns: room.columns };
    const slices = roomGroupSlices.get(ri)!;

    const roomGroups: Group[] = [];
    for (const group of sortedGroups) {
      const slice = slices.get(group.id) || [];
      if (slice.length > 0) {
        roomGroups.push({ ...group, members: slice });
      }
    }

    let seats: Seat[];
    let conflictCount = 0;
    let interleaveInfo: InterleaveInfo | undefined;

    if (shuffleType === "normal") {
      const r = normalShuffle(roomGroups, layout);
      seats = await fixConflictsWithAI(r.seats, layout, roomGroups);
      interleaveInfo = r.interleaveInfo;
    } else {
      const r = universityShuffle(roomGroups, layout);
      seats = r.seats;
      conflictCount = r.conflictCount;
    }

    results.push({
      roomIndex: ri,
      roomName: room.name || `Room ${ri + 1}`,
      groups: roomGroups,
      seats,
      conflictCount,
      studentCount: seats.filter(s => s.rollNumber).length,
      interleaveInfo,
    });
  }

  return results;
}
