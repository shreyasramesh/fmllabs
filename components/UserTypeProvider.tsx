"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@clerk/nextjs";
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
  const { userId } = useAuth();
  const [userType, setUserTypeState] = useState<UserTypeId>("millennial");
  const [showUserTypeChangeBanner, setShowUserTypeChangeBanner] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

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
    if (!mounted || !userId) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/me/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userType && isValidUserTypeId(data.userType)) {
          setUserTypeState(data.userType);
        }
      })
      .catch(() => {})
      .finally(() => {
        fetchedRef.current = false;
      });
  }, [mounted, userId]);

  useEffect(() => {
    if (!userId) fetchedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(USER_TYPE_STORAGE_KEY, userType);
    } catch {
      /* ignore */
    }
  }, [mounted, userType]);

  const setUserType = useCallback(
    (id: UserTypeId) => {
      setUserTypeState((prev) => {
        if (prev !== id) setShowUserTypeChangeBanner(true);
        return id;
      });
      if (userId) {
        fetch("/api/me/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userType: id }),
        }).catch(() => {});
      }
    },
    [userId]
  );

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
