import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../utils/api';

export const storyPoints = createAsyncThunk(
  'storyPoints',
  async (sprintId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/jira/getSPCommittedVsCompleted/${sprintId}`);
      return response;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  },
);

const storyPointsSlice = createSlice({
  name: 'storyPoints',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
  addStoryPoints: (state,action) => {
    state.data = {...state.data,...action.payload}
    state.loading = true
  },
  removeStoryPoints: (state) => {
    state.data = {}
    state.loading = false
  }},
 
});

export const { addStoryPoints,removeStoryPoints  } = storyPointsSlice.actions
export default storyPointsSlice.reducer;
