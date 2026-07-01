import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  closedPRs: null,
  leadTime: null,
  totalPRs: null,
  openPRs: null,
  mergedWithoutReviewPRs: null,
  repoList: null,
  prSizeData: null,
  gitCycleTimeData: null,
  gitApprovalRateData: null,
  gitIterationTimeData: null,
  getDoraData: null,
  standupOpenPRs: null,
  standupMergedPRsData: null,
  selectedRepo: null
};

const gitSlice = createSlice({
  name: 'gitData',
  initialState,
  reducers: {
    setClosedPRs(state, action) {
      state.closedPRs = action.payload;
    },
    setLeadTimeChanges(state, action) {
      state.leadTime = action.payload;
    },
    setTotalPRs(state, action) {
      state.totalPRs = action.payload;
    },
    setOpenPRs(state, action) {
      state.openPRs = action.payload;
    },
    setRepoList(state, action) {
      state.repoList = action.payload;
    },
    setPRSize(state, action) {
      state.prSizeData = action.payload;
    },
    setGitCycleTime(state, action) {
      state.gitCycleTimeData = action.payload;
    },
    setApprovalRate(state, action) {
      state.gitApprovalRateData = action.payload;
    },
    setIterationTime(state, action) {
      state.gitIterationTimeData = action.payload;
    },
    setMergedWithoutReviewPRs(state, action) {
      state.mergedWithoutReviewPRs = action.payload;
    },
    setGetDoraData(state, action) {
      state.getDoraData = action.payload;
    },
    setSelectedRepository(state, action) {
      state.selectedRepo = action.payload;
    },
    setStandupOpenPRsData(state, action) {
      state.standupOpenPRs = action.payload
    },

    setStandupMergedPRsData(state, action) {
      state.standupMergedPRsData = action.payload;
    },
    reset() {
      return initialState;
    }

  }
});

export const {
  setClosedPRs,
  setLeadTimeChanges,
  setTotalPRs,
  setOpenPRs,
  setRepoList,
  setMergedWithoutReviewPRs,
  setSelectedRepository,
  setPRSize,
  setGitCycleTime,
  setApprovalRate,
  setGetDoraData,
  setIterationTime,
  setStandupOpenPRsData,
  setStandupMergedPRsData,
  reset
} = gitSlice.actions;

export default gitSlice.reducer;
