import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  selectedOrgName: null,
  selectedOrgId: null,
  selectedProjectName: null,
  selectedProjectId:null,
  metricContribution:null,
  selectedSprintName: null,
  selectedSprintId:null,
  selectedProject:null,
  selectedReleaseName: null,
  selectedReleaseId:null,
  projectList: null,
  organizationList: null,
  selectedParameter:null,
  repoList:null,
  boardList: null,
  sprintList: null,
  releasesList: null,
  Sprint: null,
  Release: null,
  velocityData: null,
  bugClassificationData : null,
  dlaData: null,
  TimeToFixData: null,
  defectDensityData : null,
  costOfFixingDefectData : null,
  taskCountData: null,
  storyPointsData: null,
  isProjectOpen:null,
  isOrganizationOpen:null,
  isSprintOpen:null,
  statusCountData:null,
  selectedValue:null,
  selectedValueLabel:null,
  sonarQubeCombinedScanReport:null,
  sprintEndDate:null,
  releaseEndDate:null,
  loading:false,
  loadingEngMetrics:false,
  defectRejectionData: null,
  defectRemovalEfficiencyData:null,
  getStoryPointData:null,
  jiraTableData:null,
  availableHours: null,
  sprintLength: null,
  cycleTimeData:null,
  repositoryProvider: '',
  storyChurnData: null,
  standupBurndown:null,
  burndownData: null,
  selectedDeveloperName:null,
  jiraStatusByDeveloper:null,
  sprintCompleteDate: null,
  burndownVelocity: null,
    userList:null,
  userListByProjectId: {},
  roleRates: null,
  storyPointRatio: null,
  boardListByProjectId: {},
  holidayListByCompanyId: {},
  lastSyncedByProjectId: {},
  qaInsightsBugsData: null,
  qaInsightsTestsData: null,
  qaReferenceData: null,
  refreshToken: 0,
};

const jiraSlice = createSlice({
  name: 'jiraSlice',
  initialState,
  reducers: {
    setSelectedProject(state, action) {
        return {
        ...initialState,
        selectedOrgName: state.selectedOrgName,
        selectedOrgId: state.selectedOrgId,
        organizationList: state.organizationList,
        projectList: state.projectList,
        repoList: state.repoList,
        repositoryProvider: state.repositoryProvider,
        sprintList: state.sprintList,
        releasesList: state.releasesList,
        selectedDeveloperName: state.selectedDeveloperName,
        selectedParameter: state.selectedParameter,
        isProjectOpen: state.isProjectOpen,
        isOrganizationOpen: state.isOrganizationOpen,
        roleRates: state.roleRates,
        storyPointRatio: state.storyPointRatio,
        boardListByProjectId: state.boardListByProjectId,
        holidayListByCompanyId: state.holidayListByCompanyId,
        lastSyncedByProjectId: state.lastSyncedByProjectId,
        userList: state.userList,
        userListByProjectId: state.userListByProjectId,
        selectedProjectName: action.payload.selectedProjectName,
        selectedProjectId: action.payload.selectedProjectId,
        sonarQubeCombinedScanReport: action.payload.sonarQubeCombinedScanReport,
        metricContribution: action.payload.metricContribution,
    };
    },
    setSelectedOrganization(state, action) {
       state.selectedOrgName = action.payload.selectedOrgName ?? state.selectedOrgName;
       state.selectedOrgId = action.payload.selectedOrgId ?? state.selectedOrgId; 
    },
    updateProjectList(state, action) {
       state.projectList = action.payload;
    },
setUserList(state, action) {
  state.userList = action.payload;  
},
    setUserListForProject(state, action) {
      const { projectId, users } = action.payload || {};
      if (!projectId) {
        return;
      }
      state.userListByProjectId = {
        ...(state.userListByProjectId || {}),
        [projectId]: users || [],
      };
    },
    setSelectedSprint(state, action) {
    state.selectedSprintName = action.payload.selectedSprintName;
    state.selectedSprintId = action.payload.selectedSprintId;
    },
    setSelectedRelease(state, action) {
    state.selectedReleaseName = action.payload.selectedReleaseName;
    state.selectedReleaseId = action.payload.selectedReleaseId;
    },
    setSelectedTypeValue(state, action) {
    state.selectedValueLabel = action.payload.selectedValueLabel;
    state.selectedValue = action.payload.selectedValue;
    },
    setProjectList(state, action) {
      state.projectList = action.payload;
    },
    setOrganizationList(state, action) {
      state.organizationList = action.payload;
    },
    setRepoList(state, action) {
        state.repoList = action.payload;
      },
    setBoardList(state, action) {
        state.boardList = action.payload;
      },
    setBoardListForProject(state, action) {
      const { projectId, boards } = action.payload || {};
      if (!projectId) {
        return;
      }
      state.boardListByProjectId = {
        ...(state.boardListByProjectId || {}),
        [projectId]: boards || [],
      };
    },
    setHolidayListForCompany(state, action) {
      const { companyId, holidays } = action.payload || {};
      if (!companyId) {
        return;
      }
      state.holidayListByCompanyId = {
        ...(state.holidayListByCompanyId || {}),
        [companyId]: holidays || [],
      };
    },
    setRoleRates(state, action) {
      state.roleRates = action.payload;
    },
    setStoryPointRatio(state, action) {
      state.storyPointRatio = action.payload;
    },
    setLastSyncedForProject(state, action) {
      const { projectId, lastSynced, syncStatus } = action.payload || {};
      if (!projectId) {
        return;
      }
      state.lastSyncedByProjectId = {
        ...(state.lastSyncedByProjectId || {}),
        [projectId]: { lastSynced, syncStatus },
      };
    },
    setSelectedParameter(state, action) {
        state.selectedParameter = action.payload;
      },
    setSprintList(state, action) {
      state.sprintList = action.payload;
    },
    setReleasesList(state, action) {
      state.releasesList = action.payload;
    },
    setVelocityData(state, action) {
      state.velocityData = action.payload;
    },
    setBugClassification(state, action) {
      state.bugClassificationData = action.payload;
    },
    setTimeToFix(state, action) {
      state.TimeToFixData = action.payload;
    },
    setCostOfFixingDefect(state, action) {
      state.costOfFixingDefectData = action.payload;
    },
    setDefectDensity(state, action) {
      state.defectDensityData = action.payload;
    },
    setDefectLeakageAnalysis(state, action) {
      state.dlaData = action.payload;
    },
    setTaskCountData(state, action) {
      state.taskCountData = action.payload;
    },
    setStatusCountData(state, action) {
    state.statusCountData = action.payload;
      },
    setIsProjectOpen(state, action) {
    state.isProjectOpen = action.payload;
    },
    setIsOrganizationOpen(state, action) {
    state.isOrganizationOpen = action.payload;
    },
    setIsSprintOpen(state, action) {
    state.isProjectOpen = action.payload;
    },
    setStoryPointsData(state, action) {
      state.storyPointsData = action.payload;
    },
    setSprint(state, action) {
        state.Sprint = action.payload;
      },
    setRelease(state, action) {
        state.Release = action.payload;
    },
    setLoading(state, action) {
        state.loading = action.payload;
    },
    setLoadingEngMetrics(state, action) {
        state.loadingEngMetrics = action.payload;
    },
    setSelectedSprintEndDate(state, action) {
        state.sprintEndDate = action.payload;
    },
    setSelectedReleaseDate(state, action) {
        state.releaseEndDate = action.payload;
    },
    setDefectRejection(state, action) {
      state.defectRejectionData = action.payload;
   },
   setDefectRemovalEfficiency(state, action) {
    state.defectRemovalEfficiencyData = action.payload;
  },
  setGetStoryPointData(state, action){
    state.getStoryPointData = action.payload;
  },
  setJiraTableData(state, action){
    state.jiraTableData = action.payload;
  },
  setSprintLength(state, action){
    state.sprintLength = action.payload;
  },
    setAvailableHours(state, action){
    state.availableHours = action.payload;
  },
   setRepositoryProvider(state, action) {
    state.repositoryProvider = action.payload;
   },
   setStoryChurnData(state, action){
    state.storyChurnData = action.payload;
   },
   setCycleTime(state, action) {
    state.cycleTimeData = action.payload;
  },
  setStandupBurndown(state, action) {
    state.standupBurndown = action.payload;
  },
  setBurndownData(state, action) {
    state.burndownData = action.payload;
  },
  setJiraStatusByDeveloper(state, action) {
    state.jiraStatusByDeveloper = action.payload;
  },
  setSelectedDeveloperName(state, action) {
    state.selectedDeveloperName = action.payload;
  },
  setSprintCompleteDate(state, action) {
    state.sprintCompleteDate = action.payload;
  },
  setBurndownVelocity(state, action) {
    state.burndownVelocity = action.payload;
  },
  setQAInsightsBugsData(state, action) {
    state.qaInsightsBugsData = action.payload;
  },
  setQAInsightsTestsData(state, action) {
    state.qaInsightsTestsData = action.payload;
  },
  setQAReferenceData(state, action) {
    state.qaReferenceData = action.payload;
  },
  bumpRefreshToken(state) {
    state.refreshToken = (state.refreshToken || 0) + 1;
  },
    reset() {
        return initialState; 
      },
  }
});

export const {
  setSelectedProject,
  setSelectedTypeValue,
  setSelectedSprint,
  setProjectList,
  setSprintList,
  setReleasesList,
  setVelocityData,
  setBugClassification,
  setDefectLeakageAnalysis,
  setTimeToFix,
  setDefectDensity,
  setCostOfFixingDefect,
  setSelectedRelease,
  setSelectedParameter,
  setTaskCountData,
  setStatusCountData,
  setIsProjectOpen,
  setIsSprintOpen,
  setSprint,
  setRelease,
  setRepoList,
  setBoardList,
  setBoardListForProject,
  setStoryPointsData,
  setLoading,
  setLoadingEngMetrics,
  setSelectedReleaseDate,
  setAvailableHours,
  setSelectedSprintEndDate,
  setDefectRejection,
  setDefectRemovalEfficiency,
  setGetStoryPointData,
  setJiraTableData,
  setSprintLength,
  setCycleTime,
  setRepositoryProvider,
  setStoryChurnData,
  setStandupBurndown,
  setBurndownData,
  setJiraStatusByDeveloper,
  setSelectedDeveloperName,
  setSelectedOrganization,
  setIsOrganizationOpen,
  setOrganizationList,
  setSprintCompleteDate, 
  updateProjectList,
  setUserList,
  setUserListForProject,
  setBurndownVelocity,
  setQAInsightsBugsData,
  setQAInsightsTestsData,
  setQAReferenceData,
  setHolidayListForCompany,
  setRoleRates,
  setStoryPointRatio,
  setLastSyncedForProject,
  bumpRefreshToken,
  reset
} = jiraSlice.actions;

export default jiraSlice.reducer;
