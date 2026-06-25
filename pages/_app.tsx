import "@/styles/globals.css";
import { useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { Provider, useSelector, useDispatch } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/store";
import type { RootState, AppDispatch } from "@/store";
import { setDevMode } from "@/store/authSlice";
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

function AuthGuard({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const router = useRouter();
  const token = useSelector((s: RootState) => s.auth.token);
  const devMode = useSelector((s: RootState) => s.auth.devMode);
  const dispatch = useDispatch<AppDispatch>();

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthed = !!token || devMode;

  useEffect(() => {
    if (!isPublic && !isAuthed) {
      router.replace("/login");
    }
  }, [isPublic, isAuthed, router]);

  // Prevent protected page flash before redirect completes
  if (!isPublic && !isAuthed) return null;

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
