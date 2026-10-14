import { NavLink } from "react-router-dom";
import { KanbanSquare, LogOut, Settings } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";

export function Header() {
  const { logout, email } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex h-7 items-center gap-1.5 rounded-md px-2 text-sm transition-colors",
      isActive ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink",
    );

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-white/60 px-3 backdrop-blur-xl sm:px-5">
      <NavLink to="/" className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-pink-400 via-orange-300 to-lime-300">
          <KanbanSquare className="h-3 w-3 text-white" strokeWidth={2.5} />
        </span>
        <span className="truncate text-sm font-medium">Business Outreach Board</span>
      </NavLink>
      <nav className="flex items-center gap-0.5">
        <NavLink to="/" end className={link}>
          <KanbanSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Board</span>
        </NavLink>
        <NavLink to="/settings" className={link}>
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </NavLink>
        <span className="mx-1.5 hidden h-4 w-px bg-line-strong sm:block" />
        <span className="hidden max-w-40 truncate text-xs text-faint md:inline">{email}</span>
        <button onClick={logout} className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink" title="Sign out" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </nav>
    </header>
  );
}
