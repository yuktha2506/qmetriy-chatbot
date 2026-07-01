import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../axiosInstance';

export const closedPRs = createAsyncThunk(
  'closedPRs',
  async ({ companyId, repo,startDate,endDate,projectKeyId }, { rejectWithValue }) => {  
    try {
      const response = await api.post(`api/github/getClosedPRs/${companyId}`, { repo,startDate,endDate,projectKeyId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);


const getclosedPRsSlice = createSlice({
  name: 'closedPRs',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(closedPRs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(closedPRs.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(closedPRs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default getclosedPRsSlice.reducer;
