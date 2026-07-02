import { createSlice } from "@reduxjs/toolkit";
const initialState={
    sonarQubeGitData: null,
    loading: false,
    error: null,
  };
const sonarQubeGitSlice = createSlice({
    name: 'sonarQubeGit',
     initialState,
      reducers: {
        addData: (state,action) => {
          state.sonarQubeGitData = {...state.sonarQubeGitData,...action.payload}
          state.loading = true
        },
        reset() {
            return initialState; 
          }
      },

      
});

export const { addData,  reset } = sonarQubeGitSlice.actions
export default sonarQubeGitSlice.reducer;
