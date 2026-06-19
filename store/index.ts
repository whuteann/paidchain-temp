import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import authReducer from "./authSlice";

// localStorage is browser-only; use a no-op for SSR
const createNoopStorage = () => ({
  getItem: (_key: string) => Promise.resolve<string | null>(null),
  setItem: (_key: string, _value: string) => Promise.resolve(),
  removeItem: (_key: string) => Promise.resolve(),
});

const storage =
  typeof window !== "undefined"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("redux-persist/lib/storage").default as typeof import("redux-persist/lib/storage").default)
    : createNoopStorage();

const rootReducer = combineReducers({ auth: authReducer });

const persistedReducer = persistReducer(
  { key: "pc", version: 1, storage },
  rootReducer
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

// Use the unpersisted rootReducer for accurate state typing (no _persist key)
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
