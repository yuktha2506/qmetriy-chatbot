import { createSlice } from "@reduxjs/toolkit";

const ProjectDetailSlice = createSlice({
    name: 'ProjectDetails',
    initialState: {
        selectedProjectName: null,
        selectedProjectId: null,
        loading: false,
        error: null,
    },
    reducers: {
        addProjectData: (state, action) => {
            state.selectedProjectName = action.payload.selectedProjectName;
            state.selectedProjectId = action.payload.selectedProjectId;
            state.loading = true;
        },
    },
});

export const { addProjectData } = ProjectDetailSlice.actions;
export default ProjectDetailSlice.reducer;
