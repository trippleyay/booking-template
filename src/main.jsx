import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          // Driven by the theme variables so toasts match whatever palette
          // the forker sets in businessConfig.theme.
          style: {
            borderRadius: "var(--radius)",
            background: "var(--text)",
            color: "var(--background)",
            fontSize: "14px",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
