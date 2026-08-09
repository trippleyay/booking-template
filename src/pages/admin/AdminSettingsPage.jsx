import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAdmin } from "../../hooks/useAdmin.js";
import { useConfig } from "../../hooks/useConfig.jsx";
import { apiFetch } from "../../lib/api.js";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

export default function AdminSettingsPage() {
  const { token } = useAdmin();
  const { config } = useConfig();
  const qc = useQueryClient();

  const [tab, setTab] = useState("business");

  const { data: settingsData } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } }),
    enabled: !!token,
  });

  const saveMutation = useMutation({
    mutationFn: (updates) =>
      apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: updates,
      }),
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const tabs = [
    { id: "business",      label: "Business" },
    { id: "appearance",    label: "Appearance" },
    { id: "hours",         label: "Hours" },
    { id: "availability",  label: "Block dates" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Settings</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        Changes here override your businessConfig.js at runtime.
      </p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: tab === t.id ? "var(--primary)" : "transparent",
              color: tab === t.id ? "var(--primary)" : "var(--text-muted)",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "business"   && <BusinessTab config={config} onSave={saveMutation.mutate} saving={saveMutation.isPending} />}
      {tab === "appearance" && <AppearanceTab config={config} onSave={saveMutation.mutate} saving={saveMutation.isPending} />}
      {tab === "hours"      && <HoursTab config={config} onSave={saveMutation.mutate} saving={saveMutation.isPending} />}
      {tab === "availability" && <AvailabilityTab token={token} />}
    </div>
  );
}

// ── Business info tab ─────────────────────────────────────────────────────────

function BusinessTab({ config, onSave, saving }) {
  const [form, setForm] = useState({
    name:        config?.name        || "",
    tagline:     config?.tagline     || "",
    description: config?.description || "",
    phone:       config?.phone       || "",
    email:       config?.email       || "",
    address:     config?.address     || "",
    depositPercent:      config?.depositPercent      || 30,
    cancellationHours:   config?.cancellationHours   || 24,
  });

  useEffect(() => {
    if (config) setForm({
      name:              config.name        || "",
      tagline:           config.tagline     || "",
      description:       config.description || "",
      phone:             config.phone       || "",
      email:             config.email       || "",
      address:           config.address     || "",
      depositPercent:    config.depositPercent    || 30,
      cancellationHours: config.cancellationHours || 24,
    });
  }, [config]);

  const up = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="max-w-lg space-y-5">
      <Field label="Business name">
        <Input value={form.name} onChange={up("name")} />
      </Field>
      <Field label="Tagline">
        <Input value={form.tagline} onChange={up("tagline")} />
      </Field>
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={up("description")}
          rows={3}
          style={textareaStyle}
        />
      </Field>
      <Field label="Phone">
        <Input type="tel" value={form.phone} onChange={up("phone")} />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={up("email")} />
      </Field>
      <Field label="Address">
        <Input value={form.address} onChange={up("address")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Deposit %">
          <Input type="number" min={0} max={100} value={form.depositPercent} onChange={up("depositPercent")} />
        </Field>
        <Field label="Cancellation window (hours)">
          <Input type="number" min={0} value={form.cancellationHours} onChange={up("cancellationHours")} />
        </Field>
      </div>
      <SaveButton onClick={() => onSave(form)} saving={saving} />
    </div>
  );
}

// ── Appearance tab ────────────────────────────────────────────────────────────

function AppearanceTab({ config, onSave, saving }) {
  const [theme, setTheme] = useState(config?.theme || {});

  useEffect(() => { if (config?.theme) setTheme(config.theme); }, [config]);

  const upTheme = (k) => (e) => setTheme((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="max-w-lg space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {[
          ["primary",    "Primary color"],
          ["secondary",  "Secondary color"],
          ["accent",     "Accent color"],
          ["background", "Background"],
          ["surface",    "Surface"],
          ["text",       "Text color"],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={theme[key] || "#000000"}
                onChange={upTheme(key)}
                className="w-10 h-10 rounded cursor-pointer border"
                style={{ borderColor: "var(--border)", borderRadius: "6px", padding: "2px" }}
              />
              <Input value={theme[key] || ""} onChange={upTheme(key)} placeholder="#000000" />
            </div>
          </Field>
        ))}
      </div>
      <Field label="Border radius (e.g. 12px)">
        <Input value={theme.borderRadius || ""} onChange={upTheme("borderRadius")} />
      </Field>
      <SaveButton onClick={() => onSave({ theme })} saving={saving} />
    </div>
  );
}

// ── Hours tab ─────────────────────────────────────────────────────────────────

function HoursTab({ config, onSave, saving }) {
  const [hours, setHours] = useState(config?.hours || {});

  useEffect(() => { if (config?.hours) setHours(config.hours); }, [config]);

  const toggleDay = (day) => {
    setHours((p) => ({
      ...p,
      [day]: p[day] ? null : { open: "09:00", close: "18:00" },
    }));
  };

  const upTime = (day, field) => (e) => {
    setHours((p) => ({
      ...p,
      [day]: { ...(p[day] || {}), [field]: e.target.value },
    }));
  };

  return (
    <div className="max-w-md space-y-3">
      {DAYS.map((day) => (
        <div key={day} className="flex items-center gap-4">
          <div className="w-28 flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!hours[day]}
              onChange={() => toggleDay(day)}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
          </div>
          {hours[day] ? (
            <div className="flex items-center gap-2">
              <input type="time" value={hours[day].open}  onChange={upTime(day, "open")}  style={timeInputStyle} />
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>to</span>
              <input type="time" value={hours[day].close} onChange={upTime(day, "close")} style={timeInputStyle} />
            </div>
          ) : (
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Closed</span>
          )}
        </div>
      ))}
      <div className="pt-4">
        <SaveButton onClick={() => onSave({ hours })} saving={saving} />
      </div>
    </div>
  );
}

// ── Availability / blocked dates tab ─────────────────────────────────────────

function AvailabilityTab({ token }) {
  const qc = useQueryClient();
  const [newDate, setNewDate]     = useState("");
  const [newReason, setNewReason] = useState("");

  const { data } = useQuery({
    queryKey: ["blocked-dates"],
    queryFn: () => apiFetch("/api/admin/blocked-dates", { headers: { Authorization: `Bearer ${token}` } }),
    enabled: !!token,
  });

  const addMutation = useMutation({
    mutationFn: ({ date, reason }) =>
      apiFetch("/api/admin/blocked-dates", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { date, reason },
      }),
    onSuccess: () => {
      toast.success("Date blocked.");
      qc.invalidateQueries({ queryKey: ["blocked-dates"] });
      setNewDate("");
      setNewReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (date) =>
      apiFetch(`/api/admin/blocked-dates/${date}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success("Date unblocked.");
      qc.invalidateQueries({ queryKey: ["blocked-dates"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const blockedDates = data?.blockedDates || [];

  return (
    <div className="max-w-md">
      <h3 className="font-semibold mb-4">Block a date</h3>
      <div className="flex gap-3 mb-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          style={{ ...timeInputStyle, flex: 1 }}
        />
        <input
          type="text"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          placeholder="Reason (optional)"
          style={{ ...timeInputStyle, flex: 2 }}
        />
        <button
          onClick={() => addMutation.mutate({ date: newDate, reason: newReason })}
          disabled={!newDate || addMutation.isPending}
          className="px-4 py-2 text-sm text-white font-medium disabled:opacity-40"
          style={{ background: "var(--primary)", borderRadius: "8px" }}
        >
          Block
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {blockedDates.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No blocked dates.</p>
        )}
        {blockedDates.map((bd) => (
          <div
            key={bd.id}
            className="flex items-center justify-between p-3 border text-sm"
            style={{ borderColor: "var(--border)", borderRadius: "8px", background: "var(--surface)" }}
          >
            <div>
              <span className="font-medium">{bd.date}</span>
              {bd.reason && <span className="ml-2" style={{ color: "var(--text-muted)" }}>{bd.reason}</span>}
            </div>
            <button
              onClick={() => removeMutation.mutate(bd.date)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "8px",
        background: "var(--surface)",
        color: "var(--text)",
        width: "100%",
        padding: "10px 14px",
        fontSize: "14px",
        outline: "none",
        ...props.style,
      }}
    />
  );
}

function SaveButton({ onClick, saving }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-6 py-2.5 text-sm text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--primary)", borderRadius: "8px" }}
    >
      {saving ? "Saving..." : "Save changes"}
    </button>
  );
}

const textareaStyle = {
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  width: "100%",
  padding: "10px 14px",
  fontSize: "14px",
  outline: "none",
  resize: "vertical",
};

const timeInputStyle = {
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--surface)",
  color: "var(--text)",
  padding: "8px 12px",
  fontSize: "13px",
  outline: "none",
};
