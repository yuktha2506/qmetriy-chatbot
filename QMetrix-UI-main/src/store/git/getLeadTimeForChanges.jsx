import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../axiosInstance';

export const leadTime = createAsyncThunk(
  'leadTime',
  async ({ companyId, repo,startDate,endDate,projectKeyId }, { rejectWithValue }) => {  
    try {
      const response = await api.post(`api/github/getLeadTime/${companyId}`, { repo,startDate,endDate,projectKeyId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);


const getLeadTimeForChanges = createSlice({
  name: 'leadTime',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(leadTime.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(leadTime.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(leadTime.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default getLeadTimeForChanges.reducer;
