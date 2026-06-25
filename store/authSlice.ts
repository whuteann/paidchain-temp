import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id: string;
  status: string;
  last_active: string | null;
  open_jobs_count: number;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  devMode: boolean;
}

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  devMode: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess(
      state,
      action: PayloadAction<{ token: string; refreshToken?: string; user: AuthUser }>
    ) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken ?? null;
      state.user = action.payload.user;
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
    },
    setDevMode(state, action: PayloadAction<boolean>) {
      state.devMode = action.payload;
    },
  },
});

export const { loginSuccess, logout, setDevMode } = authSlice.actions;
export default authSlice.reducer;
