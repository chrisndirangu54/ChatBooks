"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getBusinessProfile } from "@/lib/data/business";
import { subscribeToTransactions } from "@/lib/data/transactions";
import type { BusinessProfile, Transaction } from "@/types";

interface DashboardContextValue {
  profile: BusinessProfile | null;
  transactions: Transaction[];
  loading: boolean;
  refreshProfile: () => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    getBusinessProfile(user.uid).then(setProfile);
  }, [user, profileVersion]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTransactions(user.uid, (data) => {
      setTransactions(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  return (
    <DashboardContext.Provider
      value={{
        profile,
        transactions,
        loading,
        refreshProfile: () => setProfileVersion((v) => v + 1),
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used within DashboardProvider");
  return context;
}
