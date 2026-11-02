"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type StudioMode = "simple" | "advance";

interface StudioModeContextType {
  mode: StudioMode;
  isAdvance: boolean;
  setMode: (mode: StudioMode) => void;
  toggleMode: () => void;
}

const StudioModeContext = createContext<StudioModeContextType>({
  mode: "simple",
  isAdvance: false,
  setMode: () => {},
  toggleMode: () => {},
});

const STORAGE_KEY = "ceritaobim_studio_mode";

export function StudioModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<StudioMode>("simple");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "advance" || saved === "simple") {
        setModeState(saved);
      }
    } catch {
      // Ignore localStorage errors in SSR or restricted environments
    }
  }, []);

  const setMode = (newMode: StudioMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // Ignore
    }
  };

  const toggleMode = () => {
    setMode(mode === "simple" ? "advance" : "simple");
  };

  return (
    <StudioModeContext.Provider
      value={{
        mode,
        isAdvance: mode === "advance",
        setMode,
        toggleMode,
      }}
    >
      {children}
    </StudioModeContext.Provider>
  );
}

export function useStudioMode() {
  return useContext(StudioModeContext);
}
