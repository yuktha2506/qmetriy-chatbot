import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../axiosInstance';

export const gitData = createAsyncThunk(
  'gitData',
  async (companyId, { rejectWithValue }) => {
    try {
      const response = await api.get(`api/github/getData/${companyId}`);
      return response;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  },
);

const gitDataSlice = createSlice({
  name: 'gitData',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(gitData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(gitData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(gitData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default gitDataSlice.reducer;
