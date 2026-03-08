import { Group, RoomLayout, Seat, normalShuffle, universityShuffle } from "@/lib/shuffleEngine";
import { ShuffleType } from "@/pages/Index";
import { ChevronLeft, Shuffle, Shield } from "lucide-react";

interface Props {
  groups: Group[];
  shuffleType: ShuffleType;
  setShuffleType: (t: ShuffleType) => void;
  layout: RoomLayout;
  onGenerate: (seats: Seat[], conflictCount: number) => void;
  onBack: () => void;
}

const MiniPreview = ({ type, groups }: { type: ShuffleType; groups: Group[] }) => {
  const colors = groups.slice(0, 3).map(g => g.hex);
  while (colors.length < 3) colors.push("#ccc");

  // Normal: same color vertically (dept behind each other), different horizontally
  // University: rotating pattern, no same-group adjacency
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

const Step3ShuffleType = ({ groups, shuffleType, setShuffleType, layout, onGenerate, onBack }: Props) => {
  const handleGenerate = () => {
    if (shuffleType === "normal") {
      const result = normalShuffle(groups, layout);
      onGenerate(result.seats, result.overflow, 0);
    } else {
      const result = universityShuffle(groups, layout);
      onGenerate(result.seats, result.overflow, result.conflictCount);
    }
  };

  const options: { type: ShuffleType; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      type: "normal",
      label: "Normal Shuffle",
      desc: "Students from the same department sit one behind the other in the same column. Different departments sit side by side. Roll numbers are arranged in clean sequence within each department.",
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
        <p className="text-muted-foreground text-base">How should students be arranged in the hall?</p>
      </div>

      <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        {options.map(opt => (
          <button
            key={opt.type}
            onClick={() => setShuffleType(opt.type)}
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
            <MiniPreview type={opt.type} groups={groups} />
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-10 max-w-2xl mx-auto">
        <button className="btn-secondary" onClick={onBack}>
          <ChevronLeft size={16} strokeWidth={1.5} className="mr-1" /> Back
        </button>
        <button className="btn-primary" onClick={handleGenerate}>
          Generate Arrangement →
        </button>
      </div>
    </div>
  );
};

export default Step3ShuffleType;
