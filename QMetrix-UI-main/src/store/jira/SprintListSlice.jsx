import { createSlice } from '@reduxjs/toolkit';



const sprintListSlice = createSlice({
  name: 'sprintList',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addSprintList: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeSprintList: (state) => {
      state.data = {}
      state.loading = false
    }
  },
  
});

export const { addSprintList,removeSprintList } = sprintListSlice.actions
export default sprintListSlice.reducer;
