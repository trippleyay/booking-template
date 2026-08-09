import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useConfig } from "../hooks/useConfig.jsx";
import { apiFetch } from "../lib/api.js";

export default function CancelPage() {
  const { config } = useConfig();
  const { token }  = useParams();
  const navigate   = useNavigate();

  const [state, setState] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleCancel = async () => {
    setState("loading");
    try {
      await apiFetch(`/api/bookings/cancel/${token}`, { method: "POST" });
      setState("success");
    } catch (err) {
      setErrorMsg(err.message || "Failed to cancel booking.");
      setState("error");
    }
  };

  if (!config) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)", color: "var(--text)" }}>
      <div className="max-w-md w-full text-center">
        {state === "idle" && (
          <>
            <div className="text-5xl mb-6">📅</div>
            <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
              Cancel your booking
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              Cancellations must be made at least {config.cancellationHours} hours before your appointment. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate("/")}
                className="px-6 py-3 text-sm border"
                style={{ borderColor: "var(--border)", borderRadius: "var(--radius)" }}
              >
                Keep my booking
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-3 text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                style={{ borderRadius: "var(--radius)" }}
              >
                Cancel booking
              </button>
            </div>
          </>
        )}

        {state === "loading" && (
          <div>
            <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Processing...</p>
          </div>
        )}

        {state === "success" && (
          <>
            <div className="text-5xl mb-6">✓</div>
            <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
              Booking cancelled
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              Your booking has been cancelled. You'll receive a confirmation email shortly.
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-8 py-3 text-white font-medium"
              style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
            >
              Back to {config.name}
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <div className="text-5xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
              Couldn't cancel
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              {errorMsg}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate("/")}
                className="px-6 py-3 text-sm border"
                style={{ borderColor: "var(--border)", borderRadius: "var(--radius)" }}
              >
                Go home
              </button>
              <button
                onClick={() => { setState("idle"); setErrorMsg(""); }}
                className="px-6 py-3 text-sm font-medium text-white"
                style={{ background: "var(--primary)", borderRadius: "var(--radius)" }}
              >
                Try again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
