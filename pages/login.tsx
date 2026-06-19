import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { api, ApiError } from "@/lib/api";
import { loginSuccess, setDevMode } from "@/store/authSlice";
import type { AppDispatch } from "@/store";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.auth.login(email, password);
      dispatch(
        loginSuccess({
          token: res.access_token,
          refreshToken: res.refresh_token,
          user: res.user,
        })
      );
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function enterDevMode() {
    dispatch(setDevMode(true));
    router.replace("/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          background: "var(--bg-2, #fff)",
          border: "1px solid var(--line, #e5e7eb)",
          borderRadius: 12,
          padding: 40,
          width: 360,
          boxShadow: "0 4px 24px rgba(0,0,0,.06)",
        }}
      >
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink, #111)" }}>
            PaidChain
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2, #666)", marginTop: 4 }}>
            Operations Console
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink, #111)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                padding: "9px 12px",
                border: "1px solid var(--line, #e5e7eb)",
                borderRadius: 7,
                fontSize: 14,
                outline: "none",
                background: "var(--bg, #f9fafb)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink, #111)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: "9px 12px",
                border: "1px solid var(--line, #e5e7eb)",
                borderRadius: 7,
                fontSize: 14,
                outline: "none",
                background: "var(--bg, #f9fafb)",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "var(--bad-bg, #fef2f2)",
                border: "1px solid var(--bad, #ef4444)",
                borderRadius: 7,
                fontSize: 13,
                color: "var(--bad, #ef4444)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 0",
              background: "var(--indigo, #4f46e5)",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line, #e5e7eb)", textAlign: "center" }}>
          <button
            onClick={enterDevMode}
            style={{
              background: "none",
              border: "none",
              fontSize: 12,
              color: "var(--ink-3, #aaa)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Enter dev mode (skip auth)
          </button>
        </div>
      </div>
    </div>
  );
}
