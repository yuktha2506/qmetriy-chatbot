import { createSlice } from "@reduxjs/toolkit";


const userRegisterSlice = createSlice({
    name: 'register',
    initialState: {
        data: null,
        loading: false,
        error: null,
      },
      reducers: {
        addRegister: (state,action) => {
          state.data = {...state.data,...action.payload}
          state.loading = true
        },
        removeRegister: (state) => {
          state.data = {}
          state.loading = false
        },
        updateRegisterLoading :(state) => {
          state.loading = false;
        },
      },
      
});

export const { addRegister,removeRegister,updateRegisterLoading } = userRegisterSlice.actions
export default userRegisterSlice.reducer;
