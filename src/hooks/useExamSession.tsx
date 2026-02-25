import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ColumnConfig, Group, RoomConfig, RoomResult } from "@/lib/shuffleEngine";

export type ShuffleType = "normal" | "university";

export interface ExamSession {
  totalRooms: number;
  rooms: RoomConfig[];
  rawInput: string;
  allGroups: Group[];
  shuffleType: ShuffleType;
  roomResults: RoomResult[];
  activeRoomTab: number;
}

export interface SavedSession {
  id: string;
  name: string;
  createdAt: string;
  shuffleType: ShuffleType;
  totalStudents: number;
  roomResults: RoomResult[];
}

interface ExamSessionContextType {
  session: ExamSession;
  setTotalRooms: (n: number) => void;
  setRooms: (rooms: RoomConfig[]) => void;
  updateRoom: (index: number, updates: Partial<RoomConfig>) => void;
  setRawInput: (input: string) => void;
  setAllGroups: (groups: Group[]) => void;
  setShuffleType: (type: ShuffleType) => void;
  setRoomResults: (results: RoomResult[]) => void;
  setActiveRoomTab: (tab: number) => void;
  resetSession: () => void;
  // Saved sessions
  savedSessions: SavedSession[];
  addSession: (session: SavedSession) => void;
  deleteSession: (id: string) => void;
}

const defaultSession: ExamSession = {
  totalRooms: 3,
  rooms: [],
  rawInput: "",
  allGroups: [],
  shuffleType: "normal",
  roomResults: [],
  activeRoomTab: 0,
};

const ExamSessionContext = createContext<ExamSessionContextType | null>(null);

export function ExamSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ExamSession>({ ...defaultSession });
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  const setTotalRooms = useCallback((n: number) => {
    setSession(prev => {
      const rooms = [...prev.rooms];
      while (rooms.length < n) {
        rooms.push({ index: rooms.length, name: "", columns: [] });
      }
      return { ...prev, totalRooms: n, rooms: rooms.slice(0, n) };
    });
  }, []);

  const setRooms = useCallback((rooms: RoomConfig[]) => {
    setSession(prev => ({ ...prev, rooms }));
  }, []);

  const updateRoom = useCallback((index: number, updates: Partial<RoomConfig>) => {
    setSession(prev => {
      const rooms = [...prev.rooms];
      rooms[index] = { ...rooms[index], ...updates };
      return { ...prev, rooms };
    });
  }, []);

  const setRawInput = useCallback((rawInput: string) => {
    setSession(prev => ({ ...prev, rawInput }));
  }, []);

  const setAllGroups = useCallback((allGroups: Group[]) => {
    setSession(prev => ({ ...prev, allGroups }));
  }, []);

  const setShuffleType = useCallback((shuffleType: ShuffleType) => {
    setSession(prev => ({ ...prev, shuffleType }));
  }, []);

  const setRoomResults = useCallback((roomResults: RoomResult[]) => {
    setSession(prev => ({ ...prev, roomResults }));
  }, []);

  const setActiveRoomTab = useCallback((activeRoomTab: number) => {
    setSession(prev => ({ ...prev, activeRoomTab }));
  }, []);

  const resetSession = useCallback(() => {
    setSession({ ...defaultSession });
  }, []);

  const addSession = useCallback((s: SavedSession) => {
    setSavedSessions(prev => [s, ...prev]);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSavedSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  return (
    <ExamSessionContext.Provider value={{
      session, setTotalRooms, setRooms, updateRoom, setRawInput,
      setAllGroups, setShuffleType, setRoomResults, setActiveRoomTab,
      resetSession, savedSessions, addSession, deleteSession,
    }}>
      {children}
    </ExamSessionContext.Provider>
  );
}

export function useExamSession() {
  const ctx = useContext(ExamSessionContext);
  if (!ctx) throw new Error("useExamSession must be used within ExamSessionProvider");
  return ctx;
}
