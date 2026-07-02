import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../../axiosInstance';

export const issueTypeCount = createAsyncThunk(
  'issueType',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/jira/getStatusCount/${userData}`);
      return response;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  },
);
const issueTypeSlice = createSlice({
  name: 'issueType',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    getIssueType: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeIssueType: (state) => {
      state.data = {}
      state.loading = false
    }
  },
 
});

export const { getIssueType,removeIssueType } = issueTypeSlice.actions
export default issueTypeSlice.reducer;


