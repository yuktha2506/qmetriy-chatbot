import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../../axiosInstance';

export const cycleTime = createAsyncThunk(
    'cycleTime',
    async ({projectKeyId}, { rejectWithValue }) => {
      try {
        const response = await api.get(`api/jira/getCycleTimeTrend/${projectKeyId}`);
        return response.data;  
      } catch (error) {
        return rejectWithValue(error.response?.data || "Error fetching velocity data");
      }
    }
  );
  
const cycleTimeSlice = createSlice({
  name: 'cycleTime',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(cycleTime.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cycleTime.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(cycleTime.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default cycleTimeSlice.reducer;
