import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  releaseReadinessTrendsData: null,
  releaseReadinessData: null,
  actualStoryPoints: null,
  dailyBurnup: null,
  loading: false,
  error: null,
};

const cxoSlice = createSlice({
  name: 'cxoSlice',
  initialState,
  reducers: {
    addReleaseReadinessTrendsData: (state, action) => {
      state.releaseReadinessTrendsData = action.payload;
      state.loading = false; 
    },
    addReleaseReadinessData: (state, action) => {
      state.releaseReadinessData = action.payload;
      state.loading = false;
    },
    setActualStoryPoints: (state, action) => {
      state.actualStoryPoints = action.payload;
      state.loading = false;
    },
    setDailyBurnup: (state, action) => {
      state.dailyBurnup = action.payload;
      state.loading = false;
    },
    reset() {
        return initialState; 
      },
  },
});

export const {
  addReleaseReadinessTrendsData,
  addReleaseReadinessData,
  setActualStoryPoints,
  setDailyBurnup,
  reset
} = cxoSlice.actions;

export default cxoSlice.reducer;
