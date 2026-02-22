import { useCallback, useEffect, useState } from "react";
import { ColumnConfig, Group, RoomLayout, Seat } from "@/lib/shuffleEngine";
import Step1RoomSetup from "@/components/Step1RoomSetup";
import Step2RollInput from "@/components/Step2RollInput";
import Step3ShuffleType from "@/components/Step3ShuffleType";
import Step4RoomTable from "@/components/Step4RoomTable";
import { useSavedRooms } from "@/hooks/useSavedRooms";
import { ArrowLeft } from "lucide-react";

export type ShuffleType = "normal" | "university";

export interface RoomData {
  id: string;
  name: string;
  createdAt: string;
  shuffleType: ShuffleType;
  layout: RoomLayout;
  groups: Group[];
  seatMap: Seat[];
}

const Index = () => {
  const [step, setStep] = useState(1);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [rollNumbers, setRollNumbers] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shuffleType, setShuffleType] = useState<ShuffleType>("normal");
  const [seatMap, setSeatMap] = useState<Seat[]>([]);
  const [overflow, setOverflow] = useState<string[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const { addRoom } = useSavedRooms();

  const layout: RoomLayout = { columns };

  const handleNewRoom = useCallback(() => {
    setStep(1);
    setColumns([]);
    setRollNumbers([]);
    setGroups([]);
    setSeatMap([]);
    setOverflow([]);
    setConflictCount(0);
  }, []);

  const handleSaveRoom = useCallback((name: string) => {
    const room: RoomData = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      shuffleType,
      layout,
      groups,
      seatMap,
    };
    addRoom(room);
  }, [shuffleType, layout, groups, seatMap, addRoom]);

  // Browser back button support for wizard steps
  useEffect(() => {
    const handlePopState = () => {
      setStep(prev => (prev > 1 ? prev - 1 : 1));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const goToStep = useCallback((newStep: number) => {
    if (newStep > step) {
      window.history.pushState({ step: newStep }, "");
    }
    setStep(newStep);
  }, [step]);

  return (
    <main className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            className="transition-all duration-300"
            style={{
              width: s === step ? 32 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: s <= step ? "hsl(var(--foreground))" : "hsl(var(--border))",
            }}
          />
        ))}
      </div>

      {/* Back button for steps 2-4 */}
      {step > 1 && (
        <button
          onClick={() => setStep(prev => prev - 1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back
        </button>
      )}

      <div className="step-enter" key={step}>
        {step === 1 && (
          <Step1RoomSetup
            columns={columns}
            setColumns={setColumns}
            onNext={() => goToStep(2)}
          />
        )}
        {step === 2 && (
          <Step2RollInput
            rollNumbers={rollNumbers}
            setRollNumbers={setRollNumbers}
            groups={groups}
            setGroups={setGroups}
            layout={layout}
            onNext={() => goToStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3ShuffleType
            groups={groups}
            shuffleType={shuffleType}
            setShuffleType={setShuffleType}
            layout={layout}
            onGenerate={(seats, of, cc) => {
              setSeatMap(seats);
              setOverflow(of);
              setConflictCount(cc);
              goToStep(4);
            }}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4RoomTable
            layout={layout}
            groups={groups}
            seatMap={seatMap}
            setSeatMap={setSeatMap}
            overflow={overflow}
            conflictCount={conflictCount}
            setConflictCount={setConflictCount}
            setOverflow={setOverflow}
            shuffleType={shuffleType}
            onNewRoom={handleNewRoom}
            onSave={handleSaveRoom}
            readOnly={false}
          />
        )}
      </div>
    </main>
  );
};

export default Index;
