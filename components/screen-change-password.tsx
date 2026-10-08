/* Bumipay — self-service change password */
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, Btn, PageHead, Field, Empty } from "./components";
import { api, ApiError } from "@/lib/api";

const REDIRECT_DELAY_MS = 1800;

export function ChangePassword() {
  const router = useRouter();
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
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const valid = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

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
            <Field label="Current password" hint="required">
              <input
                className="input" type="password" autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); clearFeedback(); }}
              />
            </Field>
            <Field label="New password" hint="required, at least 8 characters">
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
