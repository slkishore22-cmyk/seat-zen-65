import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { RoomData } from "@/pages/Index";

interface SavedRoomsContextType {
  rooms: RoomData[];
  addRoom: (room: RoomData) => void;
  deleteRoom: (id: string) => void;
}

const SavedRoomsContext = createContext<SavedRoomsContextType | null>(null);

export function SavedRoomsProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<RoomData[]>([]);

  const addRoom = useCallback((room: RoomData) => {
    setRooms(prev => [room, ...prev]);
  }, []);

  const deleteRoom = useCallback((id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <SavedRoomsContext.Provider value={{ rooms, addRoom, deleteRoom }}>
      {children}
    </SavedRoomsContext.Provider>
  );
}

export function useSavedRooms() {
  const ctx = useContext(SavedRoomsContext);
  if (!ctx) throw new Error("useSavedRooms must be used within SavedRoomsProvider");
  return ctx;
}
