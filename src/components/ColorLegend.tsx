import { Group } from "@/lib/shuffleEngine";

interface Props {
  groups: Group[];
}

const ColorLegend = ({ groups }: Props) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {groups.map(g => (
        <div key={g.id} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.hex }} />
          <span className="text-xs font-medium">{g.label}</span>
          <span className="text-[10px] text-muted-foreground">({g.members.length})</span>
        </div>
      ))}
    </div>
  );
};

export default ColorLegend;
