import { Group } from "@/lib/shuffleEngine";

interface Props {
  groups: Group[];
}

const ColorLegend = ({ groups }: Props) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {groups.map(g => (
        <div key={g.id} className="flex items-center gap-2">
          <span className="flex-shrink-0 rounded-full" style={{ width: 12, height: 12, backgroundColor: g.hex }} />
          <span className="text-xs font-semibold" style={{ color: g.hex }}>{g.label}</span>
          <span className="text-[10px] text-muted-foreground">({g.members.length})</span>
        </div>
      ))}
    </div>
  );
};

export default ColorLegend;
