import { createSlice } from '@reduxjs/toolkit';


const jiraConnectionSlice = createSlice({
  name: 'jiraConnection',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addJiraConnection: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeJiraConnection: (state) => {
      state.data = {}
      state.loading = false
    }
  },
 
});

export const { addJiraConnection,removeJiraConnection  } = jiraConnectionSlice.actions
export default jiraConnectionSlice.reducer;
