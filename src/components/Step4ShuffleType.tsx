import { useState } from "react";
import { useExamSession } from "@/hooks/useExamSession";
import { distributeStudentsAcrossRooms, getConflictIndices, Seat, RoomResult } from "@/lib/shuffleEngine";
import { ChevronLeft, Shuffle, Shield, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ShuffleType } from "@/hooks/useExamSession";

interface Props {
  onGenerate: () => void;
  onBack: () => void;
}

const MiniPreview = ({ type, groups }: { type: ShuffleType; groups: { hex: string }[] }) => {
  const colors = groups.slice(0, 3).map(g => g.hex);
  while (colors.length < 3) colors.push("#ccc");

  const rows = type === "normal"
    ? [[0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2]]
    : [[0, 1, 2], [1, 2, 0], [2, 0, 1]];

  return (
    <div className="flex flex-col gap-1 items-center mt-4">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((ci, si) => (
            <div
              key={si}
              className="rounded-sm"
              style={{ width: 16, height: 12, backgroundColor: colors[ci] + "60", border: `1.5px solid ${colors[ci]}` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/** Find horizontal conflicts for normal shuffle */
function findNormalConflicts(seats: Seat[], layout: { columns: { subColumns: number; rows: number }[] }): number[] {
  const conflicts: number[] = [];
  let seatOffset = 0;
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c];
    for (let r = 0; r < col.rows; r++) {
      for (let sc = 0; sc < col.subColumns - 1; sc++) {
        const idx = seatOffset + r * col.subColumns + sc;
        const nextIdx = seatOffset + r * col.subColumns + sc + 1;
        if (seats[idx].groupId && seats[nextIdx].groupId && seats[idx].groupId === seats[nextIdx].groupId) {
          if (!conflicts.includes(idx)) conflicts.push(idx);
          if (!conflicts.includes(nextIdx)) conflicts.push(nextIdx);
        }
      }
    }
    seatOffset += col.subColumns * col.rows;
  }
  return conflicts;
}

/** Find all adjacency conflicts for university shuffle (horizontal + vertical) */
function findUniversityConflicts(seats: Seat[], layout: { columns: { subColumns: number; rows: number }[] }): number[] {
  const conflictSet = getConflictIndices(seats, layout);
  return Array.from(conflictSet);
}

const Step4ShuffleType = ({ onGenerate, onBack }: Props) => {
  const { session, setShuffleType, setRoomResults } = useExamSession();
  const { allGroups, shuffleType, rooms } = session;
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Step 1: Rule-based shuffle
      const results = distributeStudentsAcrossRooms(allGroups, rooms, shuffleType);

      // Step 2: AI post-processing to fix remaining conflicts
      const improvedResults = await aiPostProcess(results, shuffleType);

      setRoomResults(improvedResults);
      onGenerate();
    } catch (e: any) {
      console.error("Generation error:", e);
      toast.error("Generation failed. Using rule-based results.");
      // Fallback to pure rule-based
      const results = distributeStudentsAcrossRooms(allGroups, rooms, shuffleType);
      setRoomResults(results);
      onGenerate();
    } finally {
      setGenerating(false);
    }
  };

  const aiPostProcess = async (results: RoomResult[], type: ShuffleType): Promise<RoomResult[]> => {
    const improved: RoomResult[] = [];

    for (const room of results) {
      const layout = { columns: rooms[room.roomIndex].columns };

      // Find conflicts based on shuffle type
      const conflicts = type === "normal"
        ? findNormalConflicts(room.seats, layout)
        : findUniversityConflicts(room.seats, layout);

      if (conflicts.length === 0) {
        improved.push(room);
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke("ai-fix-conflicts", {
          body: {
            grid: room.seats,
            layout,
            shuffleType: type,
            conflicts,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.swaps && data.swaps.length > 0) {
          const newSeats = [...room.seats];
          for (const swap of data.swaps) {
            const { fromIndex, toIndex } = swap;
            if (fromIndex >= 0 && fromIndex < newSeats.length && toIndex >= 0 && toIndex < newSeats.length) {
              // Swap roll numbers and group info
              const tempRoll = newSeats[fromIndex].rollNumber;
              const tempGroupId = newSeats[fromIndex].groupId;
              const tempColor = newSeats[fromIndex].color;
              const tempHex = newSeats[fromIndex].hex;

              newSeats[fromIndex].rollNumber = newSeats[toIndex].rollNumber;
              newSeats[fromIndex].groupId = newSeats[toIndex].groupId;
              newSeats[fromIndex].color = newSeats[toIndex].color;
              newSeats[fromIndex].hex = newSeats[toIndex].hex;

              newSeats[toIndex].rollNumber = tempRoll;
              newSeats[toIndex].groupId = tempGroupId;
              newSeats[toIndex].color = tempColor;
              newSeats[toIndex].hex = tempHex;
            }
          }

          // Recount conflicts after AI fixes
          const newConflicts = type === "normal"
            ? findNormalConflicts(newSeats, layout)
            : findUniversityConflicts(newSeats, layout);

          improved.push({
            ...room,
            seats: newSeats,
            conflictCount: newConflicts.length,
          });

          if (data.explanation) {
            toast.success(`Room ${room.roomName}: ${data.explanation}`);
          }
        } else {
          improved.push(room);
        }
      } catch (e) {
        console.warn(`AI post-processing failed for room ${room.roomName}, using rule-based result`, e);
        improved.push(room);
      }
    }

    return improved;
  };

  const options: { type: ShuffleType; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      type: "normal",
      label: "Normal Shuffle",
      desc: "Students from the same department sit one behind the other in the same column. Different departments sit side by side.",
      icon: <Shuffle size={20} strokeWidth={1.5} />,
    },
    {
      type: "university",
      label: "University Shuffle",
      desc: "No two adjacent students from the same group — maximum anti-copying security.",
      icon: <Shield size={20} strokeWidth={1.5} />,
    },
  ];

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ letterSpacing: "-0.03em" }}>Choose Arrangement Style</h1>
        <p className="text-muted-foreground text-base">How should students be arranged in {rooms.length > 1 ? "all rooms" : "the hall"}?</p>
      </div>

      <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        {options.map(opt => (
          <button
            key={opt.type}
            onClick={() => setShuffleType(opt.type)}
            disabled={generating}
            className={`glass-card p-6 text-left transition-all duration-300 ${
              shuffleType === opt.type
                ? "border-2 border-foreground scale-[1.02]"
                : "opacity-60 hover:opacity-80"
            }`}
            style={{ borderRadius: 18 }}
          >
            <div className="flex items-center gap-2 mb-2">
              {opt.icon}
              <h3 className="text-base font-semibold">{opt.label}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{opt.desc}</p>
            <MiniPreview type={opt.type} groups={allGroups} />
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-10 max-w-2xl mx-auto">
        <button className="btn-secondary" onClick={onBack} disabled={generating}>
          <ChevronLeft size={16} strokeWidth={1.5} className="mr-1" /> Back
        </button>
        <button className          className="btn-primary flex items-center gap-2"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <Sparkles size={14} />
              AI Optimizing…
            </>
          ) : (
            <>Generate All Rooms →</>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step4ShuffleType;
