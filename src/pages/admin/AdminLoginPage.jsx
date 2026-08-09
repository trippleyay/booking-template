import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "../../hooks/useAdmin.js";
import { useConfig } from "../../hooks/useConfig.jsx";

export default function AdminLoginPage() {
  const { config } = useConfig();
  const { signIn, isAuthenticated, isLoading } = useAdmin();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/admin/dashboard");
  }, [isAuthenticated, isLoading]);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      navigate("/admin/dashboard");
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--surface)",
    color: "var(--text)",
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    outline: "none",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--background)", color: "var(--text)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            {config?.name || "Admin"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Sign in to manage your bookings</p>
        </div>

        <div
          className="p-8 border"
          style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourbusiness.com"
                style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !email || !password}
              className="w-full py-3 text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50 mt-2"
              style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
