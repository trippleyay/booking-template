import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { useAdmin } from "../../hooks/useAdmin.js";
import { useConfig } from "../../hooks/useConfig.jsx";
import { apiFetch } from "../../lib/api.js";
import { formatMoney, formatTime } from "../../lib/format.js";

const STATUS_COLORS = {
  confirmed:  { bg: "#dcfce7", text: "#15803d" },
  cancelled:  { bg: "#fee2e2", text: "#dc2626" },
  completed:  { bg: "#dbeafe", text: "#1d4ed8" },
  no_show:    { bg: "#fef3c7", text: "#d97706" },
};

export default function AdminBookingsPage() {
  const { token } = useAdmin();
  const { config } = useConfig();
  const qc = useQueryClient();

  const [dateFilter, setDateFilter]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]                 = useState(1);

  const params = new URLSearchParams();
  if (dateFilter)   params.set("date", dateFilter);
  if (statusFilter) params.set("status", statusFilter);
  params.set("page", page);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", dateFilter, statusFilter, page],
    queryFn: () =>
      apiFetch(`/api/admin/bookings?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    enabled: !!token,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      apiFetch(`/api/admin/bookings/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { reason },
      }),
    onSuccess: () => {
      toast.success("Booking cancelled. Customer notified by email.");
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: (id) =>
      apiFetch(`/api/admin/bookings/${id}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success("Booking marked as completed.");
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // The booking awaiting cancellation confirmation, or null when the dialog is closed.
  const [cancelTarget, setCancelTarget] = useState(null);

  const inputStyle = {
    border: "1px solid var(--border)",
    borderRadius: "8px",
    background: "var(--surface)",
    color: "var(--text)",
    padding: "8px 12px",
    fontSize: "13px",
    outline: "none",
  };

  const bookings = data?.bookings || [];
  const total = data?.total || 0;
  const pageSize = data?.pageSize || 20;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>Bookings</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        {total} total · showing page {page}
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          style={inputStyle}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={inputStyle}
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No show</option>
        </select>
        {(dateFilter || statusFilter) && (
          <button
            onClick={() => { setDateFilter(""); setStatusFilter(""); setPage(1); }}
            className="text-sm px-3 py-2 rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-sm py-8" style={{ color: "var(--text-muted)" }}>No bookings found.</p>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const colors = STATUS_COLORS[b.status] || STATUS_COLORS.confirmed;
            return (
              <div
                key={b.id}
                className="p-4 border text-sm"
                style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{b.customer_name}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          {b.status}
                        </span>
                      </div>
                      <p style={{ color: "var(--text-muted)" }}>
                        {b.service_name} · {format(parseISO(b.date), "MMM d, yyyy")} · {formatTime(b.start_time.slice(0, 5))}
                      </p>
                      <p className="mt-1" style={{ color: "var(--text-muted)" }}>
                        {b.customer_email} · {b.customer_phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right mr-2">
                      <p className="font-medium">{formatMoney(b.deposit_cents, config?.currency)} paid</p>
                      <p style={{ color: "var(--text-muted)" }} className="text-xs mt-0.5">
                        {formatMoney(b.price_cents - b.deposit_cents, config?.currency)} remaining
                      </p>
                    </div>

                    {b.status === "confirmed" && (
                      <>
                        <button
                          onClick={() => completeMutation.mutate(b.id)}
                          disabled={completeMutation.isPending}
                          className="text-xs px-3 py-1.5 border rounded-lg hover:bg-[var(--secondary)] transition-colors"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Mark done
                        </button>
                        <button
                          onClick={() => setCancelTarget(b)}
                          disabled={cancelMutation.isPending}
                          className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {b.status === "cancelled" && b.cancel_reason && (
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Reason: {b.cancel_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
            style={{ borderColor: "var(--border)" }}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / pageSize)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
            style={{ borderColor: "var(--border)" }}
          >
            Next
          </button>
        </div>
      )}

      {cancelTarget && (
        <CancelBookingDialog
          booking={cancelTarget}
          config={config}
          pending={cancelMutation.isPending}
          onDismiss={() => setCancelTarget(null)}
          onConfirm={(reason) =>
            cancelMutation.mutate(
              { id: cancelTarget.id, reason: reason.trim() || undefined },
              { onSuccess: () => setCancelTarget(null) }
            )
          }
        />
      )}
    </div>
  );
}

// ── Cancel confirmation dialog ────────────────────────────────────────────────
// Replaces window.prompt, which browsers can suppress entirely — once a user
// ticks "prevent this page from creating additional dialogs" it returns null
// forever, and the old code read that as "changed my mind" and silently did
// nothing. Cancelling a booking emails the customer, so it must never no-op.

function CancelBookingDialog({ booking, config, pending, onDismiss, onConfirm }) {
  const [reason, setReason] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !pending) onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, onDismiss]);

  // Stop the page behind the dialog scrolling while it's open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,10,5,0.45)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        // Only a click that both starts and ends on the backdrop dismisses —
        // otherwise a text selection dragged out of the textarea closes it.
        if (e.target === e.currentTarget && !pending) onDismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        className="w-full max-w-md p-6 border"
        style={{
          background: "var(--background)",
          borderColor: "var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <h2
          id="cancel-dialog-title"
          className="text-lg font-bold mb-2"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Cancel this booking?
        </h2>

        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)" }}>{booking.customer_name}</strong> will be emailed
          straight away to let them know. This can't be undone.
        </p>

        <div
          className="p-3 mb-5 text-xs space-y-1"
          style={{ background: "var(--surface)", borderRadius: "8px", color: "var(--text-muted)" }}
        >
          <p>
            {booking.service_name} · {format(parseISO(booking.date), "EEE d MMM yyyy")} ·{" "}
            {formatTime(booking.start_time.slice(0, 5))}
          </p>
          <p>
            {formatMoney(booking.deposit_cents, config?.currency)} deposit was paid — refund it in
            Stripe if you intend to.
          </p>
        </div>

        <label htmlFor="cancel-reason" className="block text-sm font-medium mb-1.5">
          Reason <span style={{ color: "var(--text-muted)" }}>(optional, shown to the customer)</span>
        </label>
        <textarea
          id="cancel-reason"
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. Stylist unwell — we'll call to rebook"
          disabled={pending}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "var(--surface)",
            color: "var(--text)",
            width: "100%",
            padding: "10px 14px",
            fontSize: "14px",
            outline: "none",
            resize: "vertical",
          }}
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onDismiss}
            disabled={pending}
            className="px-4 py-2 text-sm border transition-colors hover:bg-[var(--surface)] disabled:opacity-40"
            style={{ borderColor: "var(--border)", borderRadius: "8px", color: "var(--text-muted)" }}
          >
            Keep booking
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60"
            style={{ borderRadius: "8px" }}
          >
            {pending ? "Cancelling..." : "Cancel booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
