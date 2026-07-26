import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type ViewMode = "pro" | "simple";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isPro: boolean;
}

const ViewModeContext = createContext<ViewModeContextType>({
  viewMode: "pro",
  setViewMode: () => {},
  isPro: true,
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("genai-viewmode") as ViewMode) || "pro";
    }
    return "pro";
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("genai-viewmode", mode);
  };

  useEffect(() => {
    const stored = localStorage.getItem("genai-viewmode") as ViewMode;
    if (stored && stored !== viewMode) setViewModeState(stored);
  }, []);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isPro: viewMode === "pro" }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
