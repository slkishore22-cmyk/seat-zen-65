import { useCallback, useState } from "react";
import { ColumnConfig, Group, RoomLayout, Seat } from "@/lib/shuffleEngine";
import TopNav from "@/components/TopNav";
import Step1RoomSetup from "@/components/Step1RoomSetup";
import Step2RollInput from "@/components/Step2RollInput";
import Step3ShuffleType from "@/components/Step3ShuffleType";
import Step4RoomTable from "@/components/Step4RoomTable";
import SavedRooms from "@/components/SavedRooms";

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
  const [activeTab, setActiveTab] = useState<"new" | "saved">("new");
  const [step, setStep] = useState(1);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [rollNumbers, setRollNumbers] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shuffleType, setShuffleType] = useState<ShuffleType>("normal");
  const [seatMap, setSeatMap] = useState<Seat[]>([]);
  const [overflow, setOverflow] = useState<string[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const [savedRooms, setSavedRooms] = useState<RoomData[]>([]);
  const [viewingRoom, setViewingRoom] = useState<RoomData | null>(null);

  const layout: RoomLayout = { columns };

  const handleNewRoom = useCallback(() => {
    setStep(1);
    setColumns([]);
    setRollNumbers([]);
    setGroups([]);
    setSeatMap([]);
    setOverflow([]);
    setConflictCount(0);
    setViewingRoom(null);
    setActiveTab("new");
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
    setSavedRooms(prev => [room, ...prev]);
  }, [shuffleType, layout, groups, seatMap]);

  const handleDeleteRoom = useCallback((id: string) => {
    setSavedRooms(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleViewRoom = useCallback((room: RoomData) => {
    setViewingRoom(room);
    setColumns(room.layout.columns);
    setGroups(room.groups);
    setSeatMap(room.seatMap);
    setShuffleType(room.shuffleType);
    setOverflow([]);
    setConflictCount(0);
    setStep(4);
    setActiveTab("new");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <TopNav activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); if (tab === "new" && !viewingRoom) setStep(1); }} />

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-32">
        {activeTab === "new" ? (
          <>
            {/* Step indicator */}
            {step <= 4 && !viewingRoom && (
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
            )}

            <div className="step-enter" key={step}>
              {step === 1 && (
                <Step1RoomSetup
                  columns={columns}
                  setColumns={setColumns}
                  onNext={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <Step2RollInput
                  rollNumbers={rollNumbers}
                  setRollNumbers={setRollNumbers}
                  groups={groups}
                  setGroups={setGroups}
                  layout={layout}
                  onNext={() => setStep(3)}
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
                    setStep(4);
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
                  readOnly={!!viewingRoom}
                />
              )}
            </div>
          </>
        ) : (
          <SavedRooms
            rooms={savedRooms}
            onView={handleViewRoom}
            onDelete={handleDeleteRoom}
            onNew={handleNewRoom}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
