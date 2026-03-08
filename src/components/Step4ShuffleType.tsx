import { useState } from "react";
import { useExamSession } from "@/hooks/useExamSession";
import { distributeStudentsAcrossRooms } from "@/lib/shuffleEngine";
import { ChevronLeft, Shuffle, Shield, Loader2, Sparkles } from "lucide-react";
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

const Step4ShuffleType = ({ onGenerate, onBack }: Props) => {
  const { session, setShuffleType, setRoomResults } = useExamSession();
  const { allGroups, shuffleType, rooms } = session;
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const results = await distributeStudentsAcrossRooms(allGroups, rooms, shuffleType);
      setRoomResults(results);
      onGenerate();
    } catch (e: any) {
      console.error("Generation error:", e);
      toast.error("Generation failed.");
    } finally {
      setGenerating(false);
    }
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
        <button
          className="btn-primary flex items-center gap-2"
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
