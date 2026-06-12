import { createContext, useContext, useEffect, useState } from "react";
const ThemeCtx = createContext();
export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    document.documentElement.className = isDark ? "dark" : "light";
  }, [isDark]);
  return (
    <ThemeCtx.Provider value={{ isDark, toggle: () => setIsDark(v => !v) }}>
      {children}
    </ThemeCtx.Provider>
  );
}
export const useTheme = () => useContext(ThemeCtx);
