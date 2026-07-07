import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";

export function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [authReady, setAuthReady] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }

    return useAuthStore.persist.onFinishHydration(() => {
      setAuthReady(true);
    });
  }, []);

  if (!authReady) {
    return (
      <section className="crm-panel">
        <p className="crm-muted-text">Restoring session...</p>
      </section>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
