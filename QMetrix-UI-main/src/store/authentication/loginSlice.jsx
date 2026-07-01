import { createSlice } from "@reduxjs/toolkit";



const userLoginSlice = createSlice({
    name: 'login',
    initialState: {
        data: null,
        loading: false,
        error: null,
      },
      reducers: {
        addLogin: (state,action) => {
          state.data = {...state.data,...action.payload}
          state.loading = true
        },
        removeLogin: (state) => {
          state.data = {}
          state.loading = false
        },
        updateLoading :(state) => {
          state.loading = false;
        }
      },
});

export const { addLogin ,removeLogin,updateLoading } = userLoginSlice.actions
export default userLoginSlice.reducer;
