import { useCallback } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { hasRequiredPermission, type PermissionRule } from "@/lib/permissions";

export function useCan() {
  const permissions = useSelector((s: RootState) => s.auth.permissions ?? []);
  const devMode = useSelector((s: RootState) => s.auth.devMode);

  return useCallback((rule: PermissionRule) => {
    if (devMode) return true;
    return hasRequiredPermission(permissions, rule);
  }, [devMode, permissions]);
}
