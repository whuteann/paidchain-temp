/* Bumipay — self-service change password */
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { Card, Btn, PageHead, Field, Empty } from "./components";
import { Icon } from "./icons";
import { api, ApiError } from "@/lib/api";
import { updateAuthUser } from "@/store/authSlice";
import type { AppDispatch, RootState } from "@/store";

const REDIRECT_DELAY_MS = 1800;

function hasLetter(value: string) {
  return /[a-zA-Z]/.test(value);
}

function hasDigit(value: string) {
  return /[0-9]/.test(value);
}

export function ChangePassword() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector((s: RootState) => s.auth.user);
  const forced = authUser?.must_change_password ?? false;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.push("/"), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [success, router]);

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const missingLetter = newPassword.length >= 8 && !hasLetter(newPassword);
  const missingDigit = newPassword.length >= 8 && !hasDigit(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const complexityOk = newPassword.length >= 8 && hasLetter(newPassword) && hasDigit(newPassword);
  const valid = currentPassword.length > 0 && complexityOk && newPassword === confirmPassword;

  function clearFeedback() {
    setError(null);
    setSuccess(false);
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      // The guard in _app.tsx redirects back here whenever must_change_password
      // is true — without clearing it in Redux immediately, the redirect below
      // just bounces straight back to this same page.
      if (authUser) dispatch(updateAuthUser({ ...authUser, must_change_password: false }));
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHead title="Change Password" sub="Update the password for your own account" />
      <Card>
        {success ? (
          <div className="card-pad" style={{ maxWidth: 420 }}>
            <Empty icon="checkCircle" title="Password changed" sub="Redirecting you to the dashboard…" />
          </div>
        ) : (
          <div className="card-pad" style={{ maxWidth: 420 }}>
            {forced && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--warn)", background: "var(--warn-bg, #fffbeb)", border: "1px solid var(--warn)", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
                <Icon name="alert" size={15} />
                <span>You need to set a new password before continuing — either this is your first time signing in, or your current one has expired.</span>
              </div>
            )}
            <Field label="Current password" hint="required">
              <input
                className="input" type="password" autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); clearFeedback(); }}
              />
            </Field>
            <Field label="New password" hint="min 8 characters, at least one letter and one digit">
              <input
                className="input" type="password" autoComplete="new-password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); clearFeedback(); }}
              />
            </Field>
            <Field label="Confirm new password" hint="required">
              <input
                className="input" type="password" autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearFeedback(); }}
              />
            </Field>
            {tooShort && <div style={{ fontSize: 12.5, color: "var(--warn)", marginBottom: 12 }}>Password must be at least 8 characters.</div>}
            {missingLetter && <div style={{ fontSize: 12.5, color: "var(--warn)", marginBottom: 12 }}>Password must contain at least one letter.</div>}
            {missingDigit && <div style={{ fontSize: 12.5, color: "var(--warn)", marginBottom: 12 }}>Password must contain at least one digit.</div>}
            {mismatch && <div style={{ fontSize: 12.5, color: "var(--bad)", marginBottom: 12 }}>Passwords do not match.</div>}
            {error && <div style={{ fontSize: 13, color: "var(--bad)", marginBottom: 12 }}>{error}</div>}
            <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
              {saving ? "Saving…" : "Change Password"}
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
