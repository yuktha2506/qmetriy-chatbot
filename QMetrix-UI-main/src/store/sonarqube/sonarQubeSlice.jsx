import { createSlice } from "@reduxjs/toolkit";

const sonarQubeSlice = createSlice({
    name: 'sonarQube',
    initialState: {
        sonarQubeData: null,
        loading: false,
        error: null,
      },
      reducers: {
        addData: (state,action) => {
          state.sonarQubeData = {...state.sonarQubeData,...action.payload}
          state.loading = true
        }
      },
});

export const { addData } = sonarQubeSlice.actions
export default sonarQubeSlice.reducer;
