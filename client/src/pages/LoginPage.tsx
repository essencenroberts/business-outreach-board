import { useState, type FormEvent } from "react";
import { KanbanSquare } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button, Field, Input } from "../components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="glass w-full max-w-sm rounded-xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-pink-400 to-lime-300 p-2.5">
            <KanbanSquare className="h-6 w-6 text-ink" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">Business Outreach Board</h1>
            <p className="text-sm text-muted">St. Louis lead tracker</p>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Email">
            <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            Sign in
          </Button>
        </div>
      </form>
    </div>
  );
}
