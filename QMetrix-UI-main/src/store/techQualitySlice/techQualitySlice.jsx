import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getTechQualityMetrics } from '../../constants';

export const fetchTechQualityMetrics = createAsyncThunk(
  'techQuality/fetchTechQualityMetrics',
  async ({ companyId, projectId, boardId }, { rejectWithValue }) => {
    try {
      const response = await getTechQualityMetrics(companyId, projectId, boardId);
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data ?? error?.message ?? 'Failed to fetch tech quality metrics');
    }
  },
);

const initialState = {
  data: null,
  loading: false,
  error: null,
  lastFetchedFor: null, // { companyId, projectId, boardId } - tracks which context the cached data is for
};

const techQualitySlice = createSlice({
  name: 'techQuality',
  initialState,
  reducers: {
    setTechQualityData(state, action) {
      state.data = action.payload;
      state.error = null;
    },
    setTechQualityLoading(state, action) {
      state.loading = action.payload;
    },
    setTechQualityError(state, action) {
      state.error = action.payload;
    },
    resetTechQuality() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTechQualityMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTechQualityMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        // API returns techQualtiy (typo) or techQuality; handle full axios response if wrapped
        const payload = action.payload;
        const body = payload?.data ?? payload;
        state.data = body?.techQuality ?? body?.techQualtiy ?? body ?? null;
        state.lastFetchedFor = action.meta?.arg ?? null;
      })
      .addCase(fetchTechQualityMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Request failed';
      });
  },
});

export const { setTechQualityData, setTechQualityLoading, setTechQualityError, resetTechQuality } =
  techQualitySlice.actions;
export default techQualitySlice.reducer;
