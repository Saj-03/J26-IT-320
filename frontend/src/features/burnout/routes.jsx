import { Route } from "react-router-dom";
import { Wellbeing } from "./pages/Wellbeing";
import { MoodCheckin } from "./pages/MoodCheckin";
import { WeeklyCheckin } from "./pages/WeeklyCheckin";
import JournalPage from "./pages/JournalPage";
import ChatPage from "./pages/ChatPage";

// Mounted under /app by App.jsx.
export default function burnoutRoutes() {
  return (
    <>
      <Route path="wellbeing" element={<Wellbeing />} />
      <Route path="wellbeing/journal" element={<JournalPage />} />
      <Route path="wellbeing/chat" element={<ChatPage />} />
      <Route path="mood" element={<MoodCheckin />} />
      <Route path="weekly-checkin" element={<WeeklyCheckin />} />
    </>
  );
}
