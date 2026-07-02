import { createSlice } from '@reduxjs/toolkit';
const storedUserData = sessionStorage.getItem('userData');
const userEmail = storedUserData ? JSON.parse(storedUserData).email : null;

const initialState = {
  theme: userEmail ? localStorage.getItem(`theme_${userEmail}`) || 'dark' : 'dark',
};

export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      localStorage.setItem(`theme_${userEmail}`, action.payload); 
    },
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
