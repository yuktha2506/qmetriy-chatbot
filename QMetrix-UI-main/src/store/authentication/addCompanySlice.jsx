import { createSlice } from '@reduxjs/toolkit';



const addCompanySlice = createSlice({
  name: 'addCompany',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addCompany: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeCompany: (state) => {
      state.data = {}
      state.loading = false
    },
    updateAddCompanyLoading :(state) => {
      state.loading = false;
    }
  },
});

export const { addCompany ,removeCompany,updateAddCompanyLoading } = addCompanySlice.actions
export default addCompanySlice.reducer;
