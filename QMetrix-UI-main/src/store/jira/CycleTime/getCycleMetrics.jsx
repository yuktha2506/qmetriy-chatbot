import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../../axiosInstance';

export const cycleMetrics = createAsyncThunk(
    'cycleMetrics',
    async ({sprintId}, { rejectWithValue }) => {
      try {
        const response = await api.get(`api/jira/getAllCycleMetrics/${sprintId}`);
        return response.data;  
      } catch (error) {
        return rejectWithValue(error.response?.data || "Error fetching velocity data");
      }
    }
  );
  
const cycleMetricsSlice = createSlice({
  name: 'cycleMetrics',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(cycleMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cycleMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(cycleMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default cycleMetricsSlice.reducer;
