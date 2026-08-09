import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfToday, parseISO, isSameDay } from "date-fns";
import toast from "react-hot-toast";
import { useConfig } from "../hooks/useConfig.jsx";
import { apiFetch } from "../lib/api.js";
import { formatMoney, formatTime } from "../lib/format.js";

const STEPS = ["Service", "Date & Time", "Your details", "Payment"];
const DAY_NAMES = ["sun","mon","tue","wed","thu","fri","sat"];

function ChevronRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

export default function BookingPage() {
  const { config } = useConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState({ service: null, date: null, slot: null, name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sid = searchParams.get("service");
    if (sid && config?.services) {
      const svc = config.services.find(s => s.id === sid);
      if (svc) { setSelected(p => ({ ...p, service: svc })); setStep(1); }
    }
  }, [config, searchParams]);

  if (!config) return null;

  const deposit = selected.service ? Math.round(selected.service.price * (config.depositPercent / 100)) : 0;
  const remaining = selected.service ? selected.service.price - deposit : 0;

  const canProceed = () => {
    if (step === 0) return !!selected.service;
    if (step === 1) return !!selected.date && !!selected.slot;
    if (step === 2) return selected.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(selected.email) && selected.phone.trim().length >= 6;
    return false;
  };

  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const { url } = await apiFetch("/api/bookings/checkout", {
        method: "POST",
        body: {
          serviceId:     selected.service.id,
          date:          selected.date,
          startTime:     selected.slot.start,
          // endTime is derived server-side from the service duration.
          customerName:  selected.name,
          customerEmail: selected.email,
          customerPhone: selected.phone,
        },
      });
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || "Failed to start payment. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: "var(--background)", color: "var(--text)" }}>
      {/* Top bar */}
      <div className="border-b px-6 py-4 flex items-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--primary)]" style={{ color: "var(--text-muted)" }}>
          ← {config.name}
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Progress bar */}
        <div className="flex items-center gap-0 mb-12 max-w-lg mx-auto lg:mx-0">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                  style={{
                    background: i < step ? "var(--primary)" : i === step ? "var(--primary)" : "var(--surface)",
                    color: i <= step ? "#fff" : "var(--text-muted)",
                    border: i > step ? "1.5px solid var(--border)" : "none",
                    boxShadow: i === step ? "0 0 0 4px var(--secondary)" : "none",
                  }}
                >
                  {i < step ? <CheckIcon /> : i + 1}
                </div>
                <span className="text-xs whitespace-nowrap hidden sm:block" style={{ color: i === step ? "var(--text)" : "var(--text-muted)", fontWeight: i === step ? 600 : 400 }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-2 mb-5" style={{ background: i < step ? "var(--primary)" : "var(--border)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Permanent 2-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main content - 7 cols */}
          <div className="lg:col-span-7">
            {step === 0 && <StepService config={config} selected={selected} setSelected={setSelected} />}
            {step === 1 && <StepDateTime config={config} selected={selected} setSelected={setSelected} />}
            {step === 2 && <StepDetails selected={selected} setSelected={setSelected} />}
            {step === 3 && <StepReview config={config} selected={selected} deposit={deposit} remaining={remaining} submitting={submitting} onCheckout={handleCheckout} />}

            {/* Nav buttons */}
            {step < 3 && (
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => step === 0 ? navigate("/") : setStep(s => s - 1)}
                  className="px-5 py-2.5 text-sm border transition-colors hover:bg-[var(--surface)]"
                  style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)" }}
                >
                  {step === 0 ? "Cancel" : "Back"}
                </button>
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canProceed()}
                  className="px-7 py-2.5 text-sm font-semibold text-white inline-flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed"
                  style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
                >
                  Continue <ChevronRightIcon />
                </button>
              </div>
            )}
          </div>

          {/* Persistent summary sidebar - 5 cols */}
          <div className="hidden lg:block lg:col-span-5">
            <div
              className="sticky top-6 p-5 border"
              style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="mb-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold">{config.name}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Booking summary</p>
              </div>

              {!selected.service ? (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--secondary)" }}>
                    <span style={{ color: "var(--primary)", fontSize: 18 }}>◷</span>
                  </div>
                  <p className="text-sm font-medium mb-1">No service selected</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Select a service to view your booking summary.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 text-sm">
                    <SummaryRow label="Service" value={selected.service.name} />
                    <SummaryRow label="Duration" value={`${selected.service.duration} min`} />
                    {selected.date && <SummaryRow label="Date" value={format(parseISO(selected.date), "EEE, MMM d")} />}
                    {selected.slot && <SummaryRow label="Time" value={formatTime(selected.slot.start)} />}
                    {selected.name && <SummaryRow label="Name" value={selected.name} />}
                  </div>
                  {deposit > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-2 text-sm" style={{ borderColor: "var(--border)" }}>
                      <div className="flex justify-between" style={{ color: "var(--text-muted)" }}>
                        <span>Total price</span>
                        <span>{formatMoney(selected.service.price, config.currency)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Deposit due now</span>
                        <span style={{ color: "var(--primary)" }}>{formatMoney(deposit, config.currency)}</span>
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                        <span>Remaining at appointment</span>
                        <span>{formatMoney(remaining, config.currency)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// ── Step 1: Service ───────────────────────────────────────────────────────────

function StepService({ config, selected, setSelected }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Choose a service</h2>
      <p className="text-sm mb-7" style={{ color: "var(--text-muted)" }}>Select the service you'd like to book.</p>
      <div className="space-y-3">
        {config.services.map(service => {
          const isSelected = selected.service?.id === service.id;
          const deposit = Math.round(service.price * (config.depositPercent / 100));
          return (
            <button
              key={service.id}
              onClick={() => setSelected(p => ({ ...p, service, slot: null }))}
              className="w-full text-left p-5 border transition-all"
              style={{
                borderColor: isSelected ? "var(--primary)" : "var(--border)",
                borderRadius: "var(--radius)",
                background: isSelected ? "var(--secondary)" : "var(--surface)",
                boxShadow: isSelected ? `0 0 0 1.5px var(--primary)` : "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center gap-4">
                {/* Radio */}
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                    background: isSelected ? "var(--primary)" : "transparent",
                  }}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{service.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {service.duration} min &nbsp;·&nbsp; {formatMoney(deposit, config.currency)} deposit today
                  </p>
                </div>
                <span className="font-bold text-base flex-shrink-0" style={{ color: isSelected ? "var(--primary)" : "var(--text)" }}>
                  {formatMoney(service.price, config.currency)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Date & Time ───────────────────────────────────────────────────────

function StepDateTime({ config, selected, setSelected }) {
  const today = startOfToday();
  const [displayDate, setDisplayDate] = useState(selected.date || format(today, "yyyy-MM-dd"));

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i);
    const dayName = DAY_NAMES[d.getDay()];
    const isClosed = !config.hours[dayName];
    return { date: format(d, "yyyy-MM-dd"), d, isClosed };
  });

  // Prefetch availability for visible days to know which are fully booked
  const { data: slotsData, isFetching } = useQuery({
    queryKey: ["slots", displayDate, selected.service?.id],
    queryFn: () => apiFetch(`/api/availability?date=${displayDate}&serviceId=${selected.service.id}`),
    enabled: !!displayDate && !!selected.service,
  });

  const slots = slotsData?.slots || [];

  const selectDate = (date) => {
    setDisplayDate(date);
    setSelected(p => ({ ...p, date, slot: null }));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Pick a date</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Available dates for <strong>{selected.service?.name}</strong>
      </p>

      {/* Date strip */}
      <div className="w-full overflow-x-auto pb-3 mb-8" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        <div className="flex gap-2" style={{ minWidth: "max-content" }}>
        {days.map(({ date, d, isClosed }) => {
          const isSelected = date === displayDate;
          return (
            <button
              key={date}
              onClick={() => !isClosed && selectDate(date)}
              disabled={isClosed}
              title={isClosed ? "Closed" : undefined}
              className="flex flex-col items-center p-3 min-w-[58px] border transition-all flex-shrink-0"
              style={{
                borderRadius: "var(--radius)",
                borderColor: isSelected ? "var(--primary)" : "var(--border)",
                background: isSelected ? "var(--secondary)" : isClosed ? "transparent" : "var(--surface)",
                boxShadow: isSelected ? `0 0 0 1.5px var(--primary)` : "none",
                opacity: isClosed ? 0.35 : 1,
                cursor: isClosed ? "not-allowed" : "pointer",
              }}
            >
              <span className="text-xs font-medium" style={{ color: isSelected ? "var(--primary)" : "var(--text-muted)" }}>
                {format(d, "EEE")}
              </span>
              <span className="text-xl font-bold my-0.5" style={{ color: isSelected ? "var(--primary)" : isClosed ? "var(--text-muted)" : "var(--text)" }}>
                {format(d, "d")}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{format(d, "MMM")}</span>
            </button>
          );
        })}
        </div>
      </div>

      {/* Time slots */}
      <div className="flex items-center gap-3 mb-4">
        <h3 className="font-semibold">Available times</h3>
        {isFetching && (
          <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {!isFetching && slots.length === 0 && (
        <div
          className="py-8 text-center border rounded-xl"
          style={{ borderColor: "var(--border)", background: "var(--surface)", borderRadius: "var(--radius)" }}
        >
          <p className="text-sm font-medium mb-1">No available times</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Try selecting a different date.</p>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {slots.map(slot => {
          const isSelected = selected.slot?.start === slot.start;
          return (
            <button
              key={slot.start}
              onClick={() => setSelected(p => ({ ...p, slot, date: displayDate }))}
              className="py-2.5 text-sm font-medium border transition-all hover:border-[var(--primary)] hover:text-[var(--primary)]"
              style={{
                borderRadius: "8px",
                borderColor: isSelected ? "var(--primary)" : "var(--border)",
                background: isSelected ? "var(--secondary)" : "var(--surface)",
                color: isSelected ? "var(--primary)" : "var(--text)",
                boxShadow: isSelected ? `0 0 0 1.5px var(--primary)` : "none",
              }}
            >
              {formatTime(slot.start)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Details ───────────────────────────────────────────────────────────

function StepDetails({ selected, setSelected }) {
  const up = (field) => (e) => setSelected(p => ({ ...p, [field]: e.target.value }));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Your details</h2>
      <p className="text-sm mb-7" style={{ color: "var(--text-muted)" }}>We'll send your confirmation to this email.</p>
      <div className="space-y-5">
        {[
          { label: "Full name", field: "name", type: "text", placeholder: "Jane Smith" },
          { label: "Email address", field: "email", type: "email", placeholder: "jane@example.com" },
          { label: "Phone number", field: "phone", type: "tel", placeholder: "+1 555 000 0000" },
        ].map(({ label, field, type, placeholder }) => (
          <div key={field}>
            <label className="block text-sm font-medium mb-2">{label}</label>
            <input
              type={type}
              value={selected[field]}
              onChange={up(field)}
              placeholder={placeholder}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--surface)",
                color: "var(--text)",
                width: "100%",
                padding: "11px 14px",
                fontSize: "14px",
                outline: "none",
              }}
              onFocus={e => e.target.style.borderColor = "var(--primary)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 4: Review & Pay ──────────────────────────────────────────────────────

function StepReview({ config, selected, deposit, remaining, submitting, onCheckout }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Review and pay</h2>
      <p className="text-sm mb-7" style={{ color: "var(--text-muted)" }}>
        A {config.depositPercent}% deposit secures your slot. Balance is due at your appointment.
      </p>

      <div className="p-5 border mb-6 space-y-3 text-sm" style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
        {[
          ["Service", selected.service?.name],
          ["Date", selected.date ? format(parseISO(selected.date), "EEEE, MMMM d, yyyy") : ""],
          ["Time", selected.slot ? formatTime(selected.slot.start) : ""],
          ["Name", selected.name],
          ["Email", selected.email],
          ["Phone", selected.phone],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span style={{ color: "var(--text-muted)" }}>{label}</span>
            <span className="font-medium text-right">{value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onCheckout}
        disabled={submitting}
        className="w-full py-4 text-white font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
      >
        {submitting ? "Redirecting to payment..." : `Pay ${formatMoney(deposit, config.currency)} deposit`}
      </button>
      <p className="mt-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Secured by Stripe. Your card details are never stored by us.
      </p>
    </div>
  );
}
