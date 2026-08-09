import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAdmin } from "../../hooks/useAdmin.js";
import { useConfig } from "../../hooks/useConfig.jsx";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "◈" },
  { to: "/admin/bookings",  label: "Bookings",  icon: "◷" },
  { to: "/admin/settings",  label: "Settings",  icon: "◎" },
];

export default function AdminLayout() {
  const { config } = useConfig();
  const { signOut } = useAdmin();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)", color: "var(--text)" }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)" }}>
            {config?.name}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Admin panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "text-white" : "hover:bg-[var(--secondary)]"
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? "var(--primary)" : "transparent",
                color: isActive ? "#fff" : "var(--text)",
                borderRadius: "8px",
              })}
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-[var(--secondary)]"
            style={{ color: "var(--text-muted)" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
