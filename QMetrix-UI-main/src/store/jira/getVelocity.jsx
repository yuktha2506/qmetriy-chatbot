import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../axiosInstance';

export const velocityData = createAsyncThunk(
    'velocityData',
    async ({ projectId,sprintId  }, { rejectWithValue }) => {
      try {
        const response = await api.get(`api/jira/getVelocity/${projectId}/${sprintId}`);
        return response.data;  
      } catch (error) {
        return rejectWithValue(error.response?.data || "Error fetching velocity data");
      }
    }
  );
  
const velocityDataSlice = createSlice({
  name: 'velocityData',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(velocityData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(velocityData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(velocityData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default velocityDataSlice.reducer;
