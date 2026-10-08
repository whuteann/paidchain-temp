import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface NavCountsState {
  merchants: number | null;
  jobs: number | null;
  terminals: number | null;
}

const initialState: NavCountsState = {
  merchants: null,
  jobs: null,
  terminals: null,
};

const navCountsSlice = createSlice({
  name: "navCounts",
  initialState,
  reducers: {
    setNavCounts(state, action: PayloadAction<NavCountsState>) {
      state.merchants = action.payload.merchants;
      state.jobs = action.payload.jobs;
      state.terminals = action.payload.terminals;
    },
  },
});

export const { setNavCounts } = navCountsSlice.actions;
export default navCountsSlice.reducer;
