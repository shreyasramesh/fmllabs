"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { USER_TYPES, isValidUserTypeId, type UserTypeId } from "@/lib/user-types";

const USER_TYPE_STORAGE_KEY = "and-then-what-user-type";

const UserTypeContext = createContext<{
  userType: UserTypeId;
  setUserType: (id: UserTypeId) => void;
  showUserTypeChangeBanner: boolean;
  dismissUserTypeChangeBanner: () => void;
} | null>(null);

export function useUserType() {
  const ctx = useContext(UserTypeContext);
  if (!ctx) throw new Error("useUserType must be used within UserTypeProvider");
  return ctx;
}

export function UserTypeProvider({ children }: { children: React.ReactNode }) {
  const [userType, setUserTypeState] = useState<UserTypeId>("millennial");
  const [showUserTypeChangeBanner, setShowUserTypeChangeBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(USER_TYPE_STORAGE_KEY);
      if (stored && isValidUserTypeId(stored)) {
        setUserTypeState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(USER_TYPE_STORAGE_KEY, userType);
    } catch {
      /* ignore */
    }
  }, [mounted, userType]);

  const setUserType = useCallback((id: UserTypeId) => {
    setUserTypeState((prev) => {
      if (prev !== id) setShowUserTypeChangeBanner(true);
      return id;
    });
  }, []);

  const dismissUserTypeChangeBanner = useCallback(
    () => setShowUserTypeChangeBanner(false),
    []
  );

  return (
    <UserTypeContext.Provider
      value={{
        userType,
        setUserType,
        showUserTypeChangeBanner,
        dismissUserTypeChangeBanner,
      }}
    >
      {children}
    </UserTypeContext.Provider>
  );
}
