import { createSlice } from '@reduxjs/toolkit';



const projectListSlice = createSlice({
  name: 'projectList',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addProjectList: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeProjectList: (state) => {
      state.data = {}
      state.loading = false
    }
  },
 
});

export const { addProjectList,removeProjectList } = projectListSlice.actions
export default projectListSlice.reducer;
