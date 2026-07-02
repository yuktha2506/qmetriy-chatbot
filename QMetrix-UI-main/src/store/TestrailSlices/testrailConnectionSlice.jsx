import { createSlice } from '@reduxjs/toolkit';


const testrailConnectionSlice = createSlice({
  name: 'testrailConnection',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addTestrailConnection: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeTestrailConnection: (state) => {
      state.data = {}
      state.loading = false
    }
  },
 
});

export const { addTestrailConnection,removeTestrailConnection  } = testrailConnectionSlice.actions
export default testrailConnectionSlice.reducer;
