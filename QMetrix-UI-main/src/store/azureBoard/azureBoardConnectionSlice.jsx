import { createSlice } from '@reduxjs/toolkit';

const azureBoardConnectionSlice = createSlice({
  name: 'azureBoardConnection',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addAzureBoardConnection: (state, action) => {
      state.data = { ...state.data, ...action.payload };
      state.loading = true;
    },
    removeAzureBoardConnection: (state) => {
      state.data = {};
      state.loading = false;
    },
  },
});

export const { addAzureBoardConnection, removeAzureBoardConnection } =
  azureBoardConnectionSlice.actions;
export default azureBoardConnectionSlice.reducer;

