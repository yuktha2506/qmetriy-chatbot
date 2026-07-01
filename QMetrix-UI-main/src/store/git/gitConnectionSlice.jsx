import { createSlice } from '@reduxjs/toolkit';

const gitConnectionSlice = createSlice({
  name: 'gitConnection',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addGitConnection: (state, action) => {
      state.data = action.payload; 
      state.loading = false; 
      state.error = null; 
    },
    removeGitConnection: (state) => {
      state.data = null; 
      state.loading = false;
      state.error = null;
    },
    setGitLoading: (state) => {
      state.loading = true; 
    },
    setGitError: (state, action) => {
      state.loading = false;
      state.error = action.payload; 
    },
  },
});

export const { addGitConnection, removeGitConnection, setGitLoading, setGitError } = gitConnectionSlice.actions;
export default gitConnectionSlice.reducer;
