import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getReleaseDashboardData } from '../../constants';

export const fetchReleaseDashboardData = createAsyncThunk(
  'releaseDashboard/fetchReleaseDashboardData',
  async ({ companyId, projectId, boardId, releaseId }, { rejectWithValue }) => {
    try {
      const response = await getReleaseDashboardData(companyId, projectId, boardId, releaseId);
      return response;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data ?? error?.message ?? 'Failed to fetch release dashboard data',
      );
    }
  },
);

const initialState = {
  data: null,
  loading: false,
  error: null,
  lastFetchedFor: null,
};

const releaseDashboardSlice = createSlice({
  name: 'releaseDashboard',
  initialState,
  reducers: {
    resetReleaseDashboard() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReleaseDashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReleaseDashboardData.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.data = action.payload ?? null;
        state.lastFetchedFor = action.meta?.arg ?? null;
      })
      .addCase(fetchReleaseDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Request failed';
      });
  },
});

export const { resetReleaseDashboard } = releaseDashboardSlice.actions;
export default releaseDashboardSlice.reducer;
