import { Route } from "react-router-dom";
import { Wellbeing } from "./pages/Wellbeing";
import { MoodCheckin } from "./pages/MoodCheckin";
import { WeeklyCheckin } from "./pages/WeeklyCheckin";
import JournalPage from "./pages/JournalPage";
import JournalMonthPage from "./pages/JournalMonthPage";
import ChatPage from "./pages/ChatPage";
import PrivacySettings from "./pages/PrivacySettings";

// Mounted under /app by App.jsx.
export default function burnoutRoutes() {
  return (
    <>
      <Route path="wellbeing" element={<Wellbeing />} />
      <Route path="journal" element={<JournalPage />} />
      <Route path="journal/month" element={<JournalMonthPage />} />
      <Route path="wellbeing/journal" element={<JournalPage />} />
      <Route path="wellbeing/chat" element={<ChatPage />} />
      <Route path="wellbeing/privacy" element={<PrivacySettings />} />
      <Route path="mood" element={<MoodCheckin />} />
      <Route path="weekly-checkin" element={<WeeklyCheckin />} />
    </>
  );
}
