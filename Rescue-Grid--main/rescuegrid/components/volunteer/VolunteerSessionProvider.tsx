'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface VolunteerProfile {
  id: string;
  name: string;
  mobile_no: string;
  type: string | null;
  skills: string | null;
  equipment: string | null;
  status: string;
  last_seen: string | null;
  tier: number | null;
  skill_ids: number[];
}

interface VolunteerSessionContextType {
  volunteer: VolunteerProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setVolunteer: (volunteer: VolunteerProfile) => void;
}

const VolunteerSessionContext = createContext<VolunteerSessionContextType | undefined>(undefined);

/**
 * Loads the logged-in volunteer once for the whole volunteer app. The session
 * cookie is httpOnly, so the profile has to come from the API.
 */
export function VolunteerSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/volunteer/me', { cache: 'no-store' });
      if (res.status === 401) {
        // Clear the cookie first: a signed-but-stale session (e.g. deleted
        // volunteer) would otherwise bounce between login and the app forever.
        await fetch('/api/volunteer/logout', { method: 'POST' }).catch(() => {});
        router.replace('/volunteer/login');
        return;
      }
      if (res.ok) setVolunteer(await res.json());
    } catch {
      // Offline — keep whatever we had.
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <VolunteerSessionContext.Provider value={{ volunteer, loading, refresh, setVolunteer }}>
      {children}
    </VolunteerSessionContext.Provider>
  );
}

export function useVolunteerSession() {
  const context = useContext(VolunteerSessionContext);
  if (!context) {
    throw new Error('useVolunteerSession must be used within a VolunteerSessionProvider');
  }
  return context;
}
