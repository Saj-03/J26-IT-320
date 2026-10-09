import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "./ui/States";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-cream flex items-center justify-center"><LoadingState /></div>;
  return user ? children : <Navigate to="/login" replace />;
}
