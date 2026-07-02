import { createSlice } from '@reduxjs/toolkit';


const getTaskCountSlice = createSlice({
  name: 'getTaskCount',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    getTaskCount: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeTaskCount: (state) => {
      state.data = {}
      state.loading = false
    }
  },
 
});

export const { getTaskCount,removeTaskCount  } = getTaskCountSlice.actions
export default getTaskCountSlice.reducer;


