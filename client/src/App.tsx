import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Background } from "./components/Background";
import { Header } from "./components/Header";
import { Spinner } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { BoardPage } from "./pages/BoardPage";
import { SettingsPage } from "./pages/SettingsPage";

function Shell() {
  const { email, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!email) return <LoginPage />;

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Routes>
          <Route path="/" element={<BoardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Background />
        <Shell />
        <Toaster theme="light" position="bottom-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}
