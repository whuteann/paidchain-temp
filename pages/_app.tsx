import "@/styles/globals.css";
import { useEffect, useRef } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { Provider, useSelector, useDispatch } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/store";
import type { RootState, AppDispatch } from "@/store";
import {
  clearRolePermissions,
  clearRolePermissionsError,
  setDevMode,
  setRolePermissions,
  setRolePermissionsError,
  updateAuthUser,
} from "@/store/authSlice";
import type { AuthUser } from "@/store/authSlice";
import type { MeOut } from "@/lib/api";
import { api } from "@/lib/api";
import { canAccessPath, getFirstAllowedPath, getRequiredPermission } from "@/lib/permissions";
import { CustomersProvider } from "@/components/customers-context";
import { JobSlaProvider } from "@/components/job-sla-context";
import { MerchantsProvider } from "@/components/merchants-context";
import { JobsProvider } from "@/components/jobs-context";
import { PayoutsProvider } from "@/components/payouts-context";
import { RentalsProvider } from "@/components/rentals-context";
import { SimCardsProvider } from "@/components/simcards-context";
import { TerminalsProvider } from "@/components/terminals-context";
import { PaperRollsProvider } from "@/components/paper-rolls-context";

const PUBLIC_PATHS = ["/login"];

function permissionsMatchUser(user: AuthUser, roleId: string | null, roleName: string | null) {
  if (user.role_id && roleId) return user.role_id === roleId;
  return !!user.role && user.role === roleName;
}

function meToAuthUser(me: MeOut, fallback: AuthUser): AuthUser {
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    role: me.role,
    role_id: me.role_id ?? fallback.role_id,
    status: me.status,
    last_active: me.last_active,
    open_jobs_count: me.open_jobs_count ?? me.jobs ?? fallback.open_jobs_count,
    permissions: me.permissions ?? [],
  };
}

function PermissionLoadError() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--ink, #111)" }}>
      <div style={{ fontSize: 14 }}>Unable to load role permissions.</div>
    </div>
  );
}

function AuthGuard({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const router = useRouter();
  const token = useSelector((s: RootState) => s.auth.token);
  const authUser = useSelector((s: RootState) => s.auth.user);
  const permissions = useSelector((s: RootState) => s.auth.permissions ?? []);
  const permissionsRoleId = useSelector((s: RootState) => s.auth.permissionsRoleId ?? null);
  const permissionsRoleName = useSelector((s: RootState) => s.auth.permissionsRoleName ?? null);
  const permissionError = useSelector((s: RootState) => s.auth.permissionsError ?? null);
  const devMode = useSelector((s: RootState) => s.auth.devMode);
  const dispatch = useDispatch<AppDispatch>();
  const loadingMeRef = useRef(false);
  const failedMeRef = useRef(false);

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthed = !!token || devMode;
  const requiredPermission = getRequiredPermission(pathname);
  const hasCurrentRolePermissions = !!authUser && permissionsMatchUser(authUser, permissionsRoleId, permissionsRoleName);

  useEffect(() => {
    if (!isPublic && !isAuthed) {
      router.replace("/login");
    }
  }, [isPublic, isAuthed, router]);

  useEffect(() => {
    if (isPublic || !isAuthed || devMode) {
      loadingMeRef.current = false;
      failedMeRef.current = false;
      return;
    }

    if (!authUser) {
      loadingMeRef.current = false;
      failedMeRef.current = false;
      dispatch(clearRolePermissions());
      return;
    }

    if (permissionsMatchUser(authUser, permissionsRoleId, permissionsRoleName)) {
      loadingMeRef.current = false;
      failedMeRef.current = false;
      if (permissionError) dispatch(clearRolePermissionsError());
      return;
    }

    if (authUser.permissions) {
      dispatch(setRolePermissions({
        roleId: authUser.role_id,
        roleName: authUser.role,
        permissions: authUser.permissions,
      }));
      return;
    }

    if (permissionError && failedMeRef.current) return;
    if (loadingMeRef.current) return;

    let cancelled = false;
    loadingMeRef.current = true;
    if (permissionError) dispatch(clearRolePermissionsError());

    api.auth.me()
      .then((me) => {
        if (cancelled) return;
        failedMeRef.current = false;
        dispatch(updateAuthUser(meToAuthUser(me, authUser)));
      })
      .catch((err) => {
        if (!cancelled) {
          failedMeRef.current = true;
          dispatch(setRolePermissionsError(err instanceof Error ? err.message : "Failed to load role permissions."));
        }
      })
      .finally(() => {
        if (!cancelled) loadingMeRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, devMode, dispatch, isAuthed, isPublic, permissionError, permissionsRoleId, permissionsRoleName]);

  useEffect(() => {
    if (isPublic || !isAuthed || devMode || !authUser || permissionError || !hasCurrentRolePermissions) {
      return;
    }

    if (!canAccessPath(pathname, permissions)) {
      router.replace(getFirstAllowedPath(permissions));
    }
  }, [
    authUser,
    devMode,
    hasCurrentRolePermissions,
    isAuthed,
    isPublic,
    pathname,
    permissionError,
    permissions,
    router,
  ]);

  // Prevent protected page flash before redirect completes
  if (!isPublic && !isAuthed) return null;
  if (!isPublic && isAuthed && !devMode && requiredPermission) {
    if (permissionError) return <PermissionLoadError />;
    if (!authUser || !hasCurrentRolePermissions) return null;
    if (!canAccessPath(pathname, permissions)) return null;
  }

  return (
    <>
      {children}
      {devMode && (
        <div
          style={{
            position: "fixed",
            bottom: 14,
            right: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "#fef3c7",
            border: "1.5px solid #f59e0b",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 600,
            color: "#92400e",
            zIndex: 9999,
            boxShadow: "0 2px 8px rgba(0,0,0,.12)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
          Dev Mode
          <button
            onClick={() => dispatch(setDevMode(false))}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              color: "#92400e",
              padding: "0 2px",
            }}
            title="Exit dev mode"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthGuard pathname={router.pathname}>
          <JobSlaProvider>
            <CustomersProvider>
              <MerchantsProvider>
                <JobsProvider>
                  <PayoutsProvider>
                    <RentalsProvider>
                      <TerminalsProvider>
                        <SimCardsProvider>
                          <PaperRollsProvider>
                            <Component {...pageProps} />
                          </PaperRollsProvider>
                        </SimCardsProvider>
                      </TerminalsProvider>
                    </RentalsProvider>
                  </PayoutsProvider>
                </JobsProvider>
              </MerchantsProvider>
            </CustomersProvider>
          </JobSlaProvider>
        </AuthGuard>
      </PersistGate>
    </Provider>
  );
}
