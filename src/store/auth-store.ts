import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthUser = {
  id: string;
  username: string;
  email: string;
  fullName?: string;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (session: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: session.user
        }),
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null
        })
    }),
    {
      name: "asquare-crm-auth"
    }
  )
);
