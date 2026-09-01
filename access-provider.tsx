import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getMyAccess,
  type AccessProfile,
  type AccessRole,
} from "@/lib/access";
import { ALL_OFF_PERMS } from "@/lib/perms";

const empty: AccessProfile = {
  userId: "",
  role: "pending",
  store: null,
  title: null,
  reportsTo: null,
  allowedTabs: [],
  assignedTrackIds: [],
  isAdmin: false,
  isChancellor: false,
  canManagePeople: false,
  canSeeCompany: false,
  canManageTraining: false,
  perms: ALL_OFF_PERMS,
  rbacRoleId: null,
  mustChangePassword: false,
};

const AccessContext = createContext<{
  access: AccessProfile;
  ready: boolean;
  refresh: () => Promise<void>;
}>({
  access: empty,
  ready: false,
  refresh: async () => undefined,
});

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [access, setAccess] = useState<AccessProfile>(empty);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAccess(empty);
      setReady(true);
      return;
    }
    try {
      setAccess(await getMyAccess());
    } catch {
      setAccess(empty);
    } finally {
      setReady(true);
    }
  }, [userId]);

  useEffect(() => {
    if (isPending) return;
    void refresh();
  }, [isPending, refresh]);

  const value = useMemo(() => ({ access, ready, refresh }), [access, ready, refresh]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}

export function useAccessRole(): AccessRole {
  return useContext(AccessContext).access.role;
}
