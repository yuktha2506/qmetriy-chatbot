import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../axiosInstance';

export const openPRs = createAsyncThunk(
  'openPRs',
  async ({ companyId, repo,projectKeyId }, { rejectWithValue }) => {  
    try {
      const response = await api.post(`api/github/getOpenPRs/${companyId}`, { repo,projectKeyId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);


const getOpenPRsSlice = createSlice({
  name: 'openPRs',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(openPRs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(openPRs.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(openPRs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default getOpenPRsSlice.reducer;
