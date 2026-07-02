import { createSlice } from '@reduxjs/toolkit';

const trelloConnectionSlice = createSlice({
  name: 'trelloConnection',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    addTrelloConnection: (state,action) => {
      state.data = {...state.data,...action.payload}
      state.loading = true
    },
    removeTrelloConnection: (state) => {
      state.data = {}
      state.loading = false
    }
  },
 
});

export const { addTrelloConnection,removeTrelloConnection  } = trelloConnectionSlice.actions
export default trelloConnectionSlice.reducer;
