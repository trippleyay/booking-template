import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useAdmin } from "../../hooks/useAdmin.js";
import { useConfig } from "../../hooks/useConfig.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatMoney, formatTime } from "../../lib/format.js";

export default function AdminDashboardPage() {
  const { token } = useAdmin();
  const { config } = useConfig();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } }),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  if (isLoading || !config) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { todayBookings = [], upcomingBookings = [], weekRevenueCents = 0, totalBookings = 0 } = data || {};

  const stats = [
    { label: "Today's bookings", value: todayBookings.length },
    { label: "Week revenue (deposits)", value: formatMoney(weekRevenueCents, config.currency) },
    { label: "Upcoming confirmed", value: upcomingBookings.length },
    { label: "Total bookings", value: totalBookings },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Dashboard</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        {format(new Date(), "EEEE, MMMM d, yyyy")}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="p-5 border"
            style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
          >
            <p className="text-xs uppercase tracking-wide font-medium mb-2" style={{ color: "var(--text-muted)" }}>
              {label}
            </p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Today */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Today's appointments</h2>
        {todayBookings.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No appointments scheduled for today.</p>
        ) : (
          <div className="space-y-2">
            {todayBookings.map((b) => (
              <BookingRow key={b.id} booking={b} config={config} />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Upcoming bookings</h2>
        {upcomingBookings.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No upcoming bookings.</p>
        ) : (
          <div className="space-y-2">
            {upcomingBookings.map((b) => (
              <BookingRow key={b.id} booking={b} config={config} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BookingRow({ booking: b, config }) {
  return (
    <div
      className="flex items-center justify-between p-4 border text-sm"
      style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
    >
      <div className="flex items-center gap-4">
        <div
          className="text-xs px-2 py-1 rounded font-mono"
          style={{ background: "var(--secondary)", color: "var(--accent)" }}
        >
          {formatTime(b.start_time.slice(0, 5))}
        </div>
        <div>
          <p className="font-medium">{b.customer_name}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{b.service_name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatMoney(b.deposit_cents, config.currency)} paid</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {b.date !== new Date().toISOString().slice(0, 10) && format(parseISO(b.date), "MMM d")}
        </p>
      </div>
    </div>
  );
}
