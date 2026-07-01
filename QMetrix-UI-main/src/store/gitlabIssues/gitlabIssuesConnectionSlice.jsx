import { createSlice } from '@reduxjs/toolkit';

const gitlabIssuesConnectionSlice = createSlice({
  name: 'gitlabIssuesConnection',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addGitlabIssuesConnection: (state, action) => {
      state.data = { ...state.data, ...action.payload };
      state.loading = true;
    },
    removeGitlabIssuesConnection: (state) => {
      state.data = {};
      state.loading = false;
    },
  },
});

export const { addGitlabIssuesConnection, removeGitlabIssuesConnection } =
  gitlabIssuesConnectionSlice.actions;
export default gitlabIssuesConnectionSlice.reducer;
