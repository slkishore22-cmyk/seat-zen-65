import { useCallback, useEffect, useState } from "react";
import { useExamSession } from "@/hooks/useExamSession";
import Step1RoomCount from "@/components/Step1RoomCount";
import Step2RoomConfig from "@/components/Step2RoomConfig";
import Step3StudentInput from "@/components/Step3StudentInput";
import Step4ShuffleType from "@/components/Step4ShuffleType";
import Step5AllRooms from "@/components/Step5AllRooms";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ShuffleType = "normal" | "university";

export interface RoomData {
  id: string;
  name: string;
  createdAt: string;
  shuffleType: ShuffleType;
  layout: { columns: { subColumns: number; rows: number }[] };
  groups: { id: string; label: string; color: string; hex: string; members: string[] }[];
  seatMap: { columnIndex: number; rowIndex: number; subColumnIndex: number; rollNumber: string | null; groupId: string | null; color: string | null; hex: string | null }[];
}

const STEP_LABELS = ["Rooms", "Configure", "Students", "Arrange", "Result"];

const Index = () => {
  const [step, setStep] = useState(1);
  const [loadingSession, setLoadingSession] = useState(true);
  const { resetSession, restoreSession, setRoomResults, setAllGroups, setCurrentSessionId } = useExamSession();

  // Load last session on mount
  useEffect(() => {
    const loadLastSession = async () => {
      try {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          restoreSession({
            roomResults: data.rooms as any,
            allGroups: data.groups as any,
            shuffleType: (data.shuffle_type as ShuffleType) || "normal",
            currentSessionId: data.id,
          });
          setStep(5);
          toast.success("Last session restored.", { duration: 2000 });
        }
      } catch (e) {
        console.warn("Could not load last session:", e);
      } finally {
        setLoadingSession(false);
      }
    };
    loadLastSession();
  }, []);

  const handleNewExam = useCallback(() => {
    setStep(1);
    resetSession();
  }, [resetSession]);

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

  const handleLoadSession = useCallback((sessionData: any) => {
    restoreSession({
      roomResults: sessionData.rooms,
      allGroups: sessionData.groups,
      shuffleType: sessionData.shuffle_type || "normal",
      currentSessionId: sessionData.id,
    });
    setStep(5);
    toast.success("Session loaded.", { duration: 2000 });
  }, [restoreSession]);

  if (loadingSession) {
    return (
      <main className="max-w-6xl mx-auto px-6 pt-24 pb-48 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 pt-24 pb-48">
      <div className="flex items-center justify-center gap-3 mb-12">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          const isActive = s === step;
          const isCompleted = s < step;
          return (
            <div key={s} className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded-full transition-all duration-300"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: isActive || isCompleted ? "hsl(var(--foreground))" : "transparent",
                  border: isActive || isCompleted ? "none" : "1.5px solid hsl(var(--muted-foreground))",
                }}
              >
                {isCompleted && <Check size={7} strokeWidth={3} className="text-primary-foreground" />}
              </div>
              <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
            </div>
          );
        })}
      </div>

      {step > 1 && step < 5 && (
        <button
          onClick={() => setStep(prev => prev - 1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back
        </button>
      )}

      <div className="step-enter" key={step}>
        {step === 1 && <Step1RoomCount onNext={() => goToStep(2)} onLoadSession={handleLoadSession} />}
        {step === 2 && <Step2RoomConfig onNext={() => goToStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Step3StudentInput onNext={() => goToStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <Step4ShuffleType onGenerate={() => goToStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && <Step5AllRooms onNewExam={handleNewExam} />}
      </div>
    </main>
  );
};

export default Index;
