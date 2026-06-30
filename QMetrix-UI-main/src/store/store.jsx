import { configureStore } from '@reduxjs/toolkit';
import userSlice from './user/userSlice'
import themeSlice from './theme/themeSlice';
import addCompanySlice from './authentication/addCompanySlice';
import userLoginSlice from "./authentication/loginSlice"
import userRegisterSlice from "./authentication/registerSlice";
import JiraConnectionSlice from "./jira/JiraConnectionSlice";
import syncJiraSlice from "./jira/SyncJiraList";
import projectListSlice from "./jira/ProjectListSlice";
import sprintListSlice  from "./jira/SprintListSlice";
import gitDataSlice from "./git/gitData";
import getMergedPRWithoutReviewSlice from './git/getMergedPRWithoutRvw';
import getOpenPRsSlice from './git/getOpenPR';
import getclosedPRsSlice from './git/getClosedPR';
import getLeadTimeForChanges from './git/getLeadTimeForChanges';
import velocityDataSlice from './jira/getVelocity';
import getTaskCountSlice from './jira/IssueType/getTaskCountSlice'
import IssueTypeSlice from './jira/IssueType/IssueTypeSlice';
import sonarQubeSlice from './sonarqube/sonarQubeSlice';
import sonarQubeGitSlice from './sonarqube/sonarQubeGitSlice';
import gitSlice from './GitSlices/gitSlices';
import jiraSlice from './JiraSlices/jiraSlice';
import cxoSlice from './CXOSlices/cxoSlice';
import azureBoardConnectionSlice from './azureBoard/azureBoardConnectionSlice';
import gitlabIssuesConnectionSlice from './gitlabIssues/gitlabIssuesConnectionSlice';
import techQualityReducer from './techQualitySlice/techQualitySlice';
import releaseDashboardReducer from './releaseDashboard/releaseDashboardSlice';
import aiChatReducer from './ai/aiChatSlice';
import aiUploadReducer from './ai/aiUploadSlice';

export const store = configureStore({
    reducer: {
        user: userSlice,
        theme:themeSlice,
        login:userLoginSlice,
        register:userRegisterSlice,
        addCompany:addCompanySlice,
        jiraConnection:JiraConnectionSlice,
        syncJira:syncJiraSlice,
        projectList:projectListSlice,
        sprintList:sprintListSlice,
        gitData:gitDataSlice,
        mergedPRsWithoutReview:getMergedPRWithoutReviewSlice,
        openPRs:getOpenPRsSlice,
        closedPRs:getclosedPRsSlice,
        leadTime:getLeadTimeForChanges,
        velocityData:velocityDataSlice,
        getStatusCount:IssueTypeSlice,
        getTaskCount:getTaskCountSlice,
        sonarQube:sonarQubeSlice,
        sonarQubeGit:sonarQubeGitSlice,
        git:gitSlice,
        jira:jiraSlice,
        cxo:cxoSlice,
        azureBoardConnection: azureBoardConnectionSlice,
        gitlabIssuesConnection: gitlabIssuesConnectionSlice,
        techQuality: techQualityReducer,
        releaseDashboard: releaseDashboardReducer,
        aiChat: aiChatReducer,
        aiUpload: aiUploadReducer,
    },
});

export default store;
