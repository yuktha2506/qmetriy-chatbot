import { createSlice } from '@reduxjs/toolkit';


const syncJiraSlice = createSlice({
  name: 'syncJira',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addSyncJira: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeSyncJira: (state) => {
      state.data = {}
      state.loading = false
    }
  },

});

export const { addSyncJira,removeSyncJira } = syncJiraSlice.actions
export default syncJiraSlice.reducer;
