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
  permissions?: string[];
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];
  permissionsRoleId: string | null;
  permissionsRoleName: string | null;
  permissionsError: string | null;
  devMode: boolean;
}

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  permissions: [],
  permissionsRoleId: null,
  permissionsRoleName: null,
  permissionsError: null,
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
      state.permissions = action.payload.user.permissions ?? [];
      state.permissionsRoleId = action.payload.user.role_id;
      state.permissionsRoleName = action.payload.user.role;
      state.permissionsError = null;
    },
    updateAuthUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.permissions = action.payload.permissions ?? [];
      state.permissionsRoleId = action.payload.role_id;
      state.permissionsRoleName = action.payload.role;
      state.permissionsError = null;
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.permissions = [];
      state.permissionsRoleId = null;
      state.permissionsRoleName = null;
      state.permissionsError = null;
    },
    setRolePermissions(
      state,
      action: PayloadAction<{ roleId: string | null; roleName: string | null; permissions: string[] }>
    ) {
      state.permissions = action.payload.permissions;
      state.permissionsRoleId = action.payload.roleId;
      state.permissionsRoleName = action.payload.roleName;
      state.permissionsError = null;
      if (
        state.user &&
        state.user.role_id === action.payload.roleId &&
        state.user.role === action.payload.roleName
      ) {
        state.user.permissions = action.payload.permissions;
      }
    },
    clearRolePermissions(state) {
      state.permissions = [];
      state.permissionsRoleId = null;
      state.permissionsRoleName = null;
      state.permissionsError = null;
    },
    setRolePermissionsError(state, action: PayloadAction<string>) {
      state.permissionsError = action.payload;
    },
    clearRolePermissionsError(state) {
      state.permissionsError = null;
    },
    setDevMode(state, action: PayloadAction<boolean>) {
      state.devMode = action.payload;
    },
  },
});

export const {
  loginSuccess,
  updateAuthUser,
  logout,
  setRolePermissions,
  clearRolePermissions,
  setRolePermissionsError,
  clearRolePermissionsError,
  setDevMode,
} = authSlice.actions;
export default authSlice.reducer;
