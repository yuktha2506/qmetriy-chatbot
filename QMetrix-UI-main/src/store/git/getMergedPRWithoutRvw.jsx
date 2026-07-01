import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../axiosInstance';

export const mergedPRsWithoutReview = createAsyncThunk(
  'mergedPRsWithoutReview',
  async ({ companyId, repo }, { rejectWithValue }) => { 
    try {
      const response = await api.post(`api/github/getMergedPRsWithoutReview/${companyId}`, { repo });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);


const getMergedPRWithoutRvwSlice = createSlice({
  name: 'mergedPRsWithoutReview',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(mergedPRsWithoutReview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(mergedPRsWithoutReview.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(mergedPRsWithoutReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default getMergedPRWithoutRvwSlice.reducer;
