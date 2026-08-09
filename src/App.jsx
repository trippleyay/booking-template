import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useConfig } from "./hooks/useConfig.jsx";
import useTheme from "./hooks/useTheme.js";

// Public pages
import LandingPage from "./pages/LandingPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import BookingSuccessPage from "./pages/BookingSuccessPage.jsx";
import CancelPage from "./pages/CancelPage.jsx";

// Admin pages
import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminBookingsPage from "./pages/admin/AdminBookingsPage.jsx";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage.jsx";
import AdminLayout from "./components/admin/AdminLayout.jsx";
import RequireAdmin from "./components/admin/RequireAdmin.jsx";

function ThemeLoader({ children }) {
  const { config, isLoading } = useConfig();
  useTheme(config);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeLoader>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/booking/success" element={<BookingSuccessPage />} />
          <Route path="/cancel/:token" element={<CancelPage />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="bookings" element={<AdminBookingsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeLoader>
    </BrowserRouter>
  );
}
