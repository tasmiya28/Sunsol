import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { ThemeProvider } from "./context/ThemeContext";
import "./App.css";

const ADMIN_EMAILS = ["demo@gmail.com", "admin@sunsol.com", "2410018@ritindia.edu", "admuthe@ritindia.edu"];

export default function App() {
  const [user, setUser] = useState(null);
  function handleLogin(userData) {
    const isAdmin = ADMIN_EMAILS.includes(userData.email?.toLowerCase().trim());
    setUser({ ...userData, role: isAdmin ? "admin" : "user" });
  }
  return (
    <ThemeProvider>
      {!user
        ? <Login onLogin={handleLogin} />
        : <Dashboard user={user} onLogout={() => setUser(null)} />
      }
    </ThemeProvider>
  );
}
