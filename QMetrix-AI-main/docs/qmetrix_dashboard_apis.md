# QMetrix API Reference — By Dashboard

**Version:** 1.0  
**Last updated:** May 2026  
**Scope:** QMetrix-UI (`constants.js`, pages, `commonFunctions.js`) and QMetrix-API route modules.

---

## Table of contents

1. [Overview](#1-overview)
2. [Authentication and common parameters](#2-authentication-and-common-parameters)
3. [Architecture — aggregated vs legacy endpoints](#3-architecture--aggregated-vs-legacy-endpoints)
4. [QMetry360 — `/dashboard`](#4-qmetry360--dashboard)
5. [Eng Metrics — Jira — `/jiraDashboard`](#5-eng-metrics--jira--jiradashboard)
6. [Eng Metrics — Git — `/gitDashboard`](#6-eng-metrics--git--gitdashboard)
7. [Standup — `/standUp`](#7-standup--standup)
8. [Tech Quality — `/techQuality`](#8-tech-quality--techquality)
9. [Release — `/release`](#9-release--release)
10. [Integration — `/integration`](#10-integration--integration)
11. [Capacity Planning](#11-capacity-planning)
12. [Cross-dashboard shared APIs](#12-cross-dashboard-shared-apis)
13. [Route → API load priority](#13-route--api-load-priority)
14. [Code references](#14-code-references)
15. [Export to PDF](#15-export-to-pdf)

---

## 1. Overview

All backend routes are mounted under:

```
{API_BASE_URL}/api
```

The UI default base URL is configured in `QMetrix-UI/src/axiosInstance.js` (typically `http://localhost:3000`).

| UI route | Page / component | Primary data API |
|----------|------------------|------------------|
| `/dashboard` | `QMetrixBeta.jsx` | `GET /api/analytics/getCXOData/...` |
| `/jiraDashboard` | `JiraDashboard.jsx` | `GET /api/analytics/getProjectManagementData/...` |
| `/gitDashboard` | `GitDashboard.jsx` | `GET /api/analytics/getGitData/...` |
| `/standUp` | `StandUpPage.jsx` | `GET /api/analytics/getStandupData/...` |
| `/techQuality` | `TechQuality.jsx` | `GET /api/techQuality/getTechQualityMetrics/...` |
| `/release` | `ReleaseDashboard.jsx` | `GET /api/releaseDashboard/releaseData/...` |
| `/integration` | `Integration.jsx` | `POST /api/connection/add/...` |
| `/capacityPlanning` | `capacityPlanning.jsx` | PM analytics + Jira CRUD |

---

## 2. Authentication and common parameters

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `qmetrix-token` | JWT from login | Yes (authenticated routes) |
| `Content-Type` | `application/json` | POST/PUT bodies |

### Path parameters (most dashboards)

| Param | Source | Description |
|-------|--------|-------------|
| `companyId` | `sessionStorage.companyId` | Tenant company |
| `projectId` | `sessionStorage.projectId` | Jira/PM project |
| `boardId` | `sessionStorage.boardId` | Board within project |

### Query parameters (typical)

| Param | When used |
|-------|-----------|
| `sprintId` | Sprint-scoped metrics |
| `releaseId` | Release-scoped metrics |
| `developer` | Standup developer filter (`team` or assignee name) |
| `repo` | Git dashboard — repository name |
| `sections` | Comma-separated section names for aggregated endpoints |
| `estimationType` | `storyPoints` or `hours` (velocity / PM) |
| `pageValue` | CXO trends page context |

---

## 3. Architecture — aggregated vs legacy endpoints

Modern dashboards prefer **four aggregated analytics endpoints** that bundle many metrics. Legacy per-metric routes still exist on the API and in `constants.js`; most UI call sites have migrated to analytics (older calls are commented out).

### Aggregated endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/analytics/getProjectManagementData/{companyId}/{projectId}/{boardId}` | Jira / PM metrics |
| `GET /api/analytics/getStandupData/{companyId}/{projectId}/{boardId}` | Standup-specific data |
| `GET /api/analytics/getGitData/{companyId}/{projectId}/{boardId}` | Git / GitLab PR metrics |
| `GET /api/analytics/getCXOData/{companyId}/{projectId}/{boardId}` | Release readiness & engineering scores |

**Example request:**

```http
GET /api/analytics/getProjectManagementData/{companyId}/{projectId}/{boardId}?sprintId={sprintId}&sections=velocity,taskCount&estimationType=storyPoints
qmetrix-token: <token>
```

**UI helpers** (in `QMetrix-UI/src/constants.js`):

- `getProjectManagementData({ sections, value, estimationType })`
- `getStandupDashboardData({ sections, value })`
- `getGitDashboardData({ sections, value })`
- `getCXODashboardData({ sections, value, pageValue })`

Orchestration lives in `QMetrix-UI/src/utils/commonFunctions.js` (`fetchProjectManagementData`, `fetchStandupDashboardData`, etc.). Load **priority** depends on `location.pathname` when sprint/release changes.

---

## 4. QMetry360 — `/dashboard`

**Files:** `QMetrixBeta.jsx`, `ReleaseReadinessLevel2.jsx`, `ESDashboard.jsx`, `DynamicFormulaHandlingModal.jsx`

### Primary APIs

| Endpoint | Method | UI helper | Usage |
|----------|--------|-----------|--------|
| `/api/analytics/getCXOData/{companyId}/{projectId}/{boardId}` | GET | `getCXODashboardData` | Release readiness & engineering score cards |
| `/api/analytics/getProjectManagementData/...` | GET | `getProjectManagementData` | Background preload (status, tasks, etc.) |
| `/api/analytics/getStandupData/...` | GET | `getStandupDashboardData` | Background preload |
| `/api/analytics/getGitData/...` | GET | `getGitDashboardData` | Background preload (if `repo` in session) |
| `/api/cxo/editWeightage/{companyId}/{projectId}/{boardId}/{title}` | POST | `updateWeightage` | Edit score formula weights |

### CXO aggregated sections

| Section | Redux / UI |
|---------|------------|
| `cxoData` | Release readiness snapshot |
| `cxoTrends` | Trend charts (`QMetrixBeta` uses `sections: 'cxoTrends'`) |

### Legacy CXO (replaced by analytics)

| Endpoint | Helper |
|----------|--------|
| `GET /api/cxo/getCXO/...` | `getReleaseReadinessDetails` |
| `GET /api/cxo/getCXOtrends/...` | `fetchGetReleaseReadinessTrends` |

### Supporting (filters)

| Endpoint | Helper |
|----------|--------|
| `GET /api/jira/getProjectList/{companyId}` | `getProjectList` |
| `GET /api/jira/getBoardList/{companyId}/{projectId}` | `getBoardList` |
| `GET /api/jira/getSprintList/...` | `getSprintList` |
| `GET /api/jira/getReleases/...` | `getReleaseDetails` |
| `GET /api/company/getAllOrgs/{companyId}` | `getAllOrgsListAPI` |
| `GET /api/jira/getLastSynced/{companyId}/{projectId}` | Header sync timestamp |

### Load order (sprint change)

1. `getCXOData` (priority)  
2. Parallel: `getProjectManagementData`, `getStandupData`, optional `getGitData`

---

## 5. Eng Metrics — Jira — `/jiraDashboard`

**File:** `JiraDashboard.jsx`  
**Widgets:** Velocity, Burndown, Committed vs Completed, Issue Type, Cycle Time, Defect metrics, Bug Classification, accordion views.

### Primary API

| Endpoint | Helper | Usage |
|----------|--------|--------|
| `GET /api/analytics/getProjectManagementData/...` | `getProjectManagementData` | Main data via `fetchProjectManagementData` → Redux |

### PM sections → UI mapping

| Section | Redux action | Widget / area |
|---------|--------------|---------------|
| `velocity` | `setVelocityData` | Velocity |
| `taskCount` | `setTaskCountData` | Issue type / tasks |
| `statusCount` | `setStatusCountData` | Status breakdown |
| `spCommittedVsCompleted` | `setStoryPointsData` | Committed vs Completed |
| `bugClassification` | `setBugClassification` | Bug Classification |
| `defectDensity` | `setDefectDensity` | Defect Density |
| `defectRejection` | `setDefectRejection` | Defect Rejection Ratio |
| `defectRemovalEfficiency` | `setDefectRemovalEfficiency` | DRE |
| `timeToFix` | `setTimeToFix` | Time to Fix Bug |
| `cycleTime` | `setCycleTime` | Cycle Time |
| `burndownData` | `setBurndownData` | Burndown |
| `actualStoryPoints` | `setActualStoryPoints` | Burndown SP line |
| `burndownVelocity` | `setBurndownVelocity` | Burndown velocity target |
| `defectLeakage` | `setDefectLeakageAnalysis` | Defect Leakage |
| `costOfFixing` | `setCostOfFixingDefect` | Cost of Fixing Defects |
| `sprintLength` | `setSprintLength` | Sprint metadata |
| `qaInsightsBugs` | `setQAInsightsBugsData` | QA bugs |
| `qaInsightsTests` | `setQAInsightsTestsData` | QA tests |
| `qaReference` | `setQAReferenceData` | QA reference |
| `storyPointData` | `setGetStoryPointData` | Story point breakdown |
| `availableHours` | `setAvailableHours` | Dev capacity hours |
| `sprintCompleteDate` | `setSprintCompleteDate` | Sprint completion |
| `userList` | `setUserList` | Assignees |

**Note:** `dailyBurnup` and `storyChurn` are loaded from **Standup** analytics, not PM (different backend logic).

### Direct call from Jira page

`getProjectManagementData({ sections: 'velocity', estimationType, value })` — refetch when toggling Story Points vs Hours.

### Background preload

`getCXOData`, `getStandupData`, optional `getGitData`.

### Legacy `/api/jira/...` (API exists; UI mostly unused)

Examples: `getVelocity`, `getIssueType`, `getCycleTime`, `getBugClassification`, `getDefectDensity`, `getBurndownData`, `getSPCommittedVsCompleted`, `costOfFixingDefects`, etc.

### ClickUp boards

| Endpoint | Helper |
|----------|--------|
| `GET /api/clickup/getMilestoneList/...` | `getClickupMilestoneList` |
| `GET /api/clickup/getClickUpIssues/...` | `getClickUpIssues` |

---

## 6. Eng Metrics — Git — `/gitDashboard`

**File:** `GitDashboard.jsx`  
**Requires:** `repo` in session.

### Primary API

| Endpoint | Helper |
|----------|--------|
| `GET /api/analytics/getGitData/...` | `getGitDashboardData` |

Query: `sprintId` or `releaseId`, `repo`, optional `developer`, `sections`.

### Git sections → UI

| Section | Redux | Widget |
|---------|-------|--------|
| `closedPRs` | `setClosedPRs` | Closed PRs/MRs |
| `openPRs` | `setOpenPRs` | Open PRs |
| `totalPRs` | `setTotalPRs` | Total PRs |
| `mergedWithoutReview` | `setMergedWithoutReviewPRs` | Merged without review |
| `prSize` | `setPRSize` | PR size |
| `gitCycleTime` | `setGitCycleTime` | Git cycle time |
| `approvalRate` | `setApprovalRate` | Approval rate |
| `iterationTime` | `setIterationTime` | PR iteration time |
| `leadTime` | `setLeadTimeChanges` | Lead time for changes |
| `doraMetrics` | `setGetDoraData` | DORA metrics |

### Legacy SCM (GitHub vs GitLab)

Provider from Redux `repositoryProvider`. POST body: `{ repo }`. Query: `sprintId` or `releaseId`.

| Metric | GitHub | GitLab |
|--------|--------|--------|
| Closed | `POST /api/github/getClosedPRs/...` | `POST /api/gitlab/getClosedMergeRequest/...` |
| Open | `POST .../getOpenPRs/...` | `POST .../getOpenMergeRequest/...` |
| Total | `POST .../getTotalPRs/...` | `POST .../getTotalMRs/...` |
| Merged w/o review | `POST .../getMergedPRsWithoutReview/...` | `POST .../getMergedMRsWithoutReview/...` |
| Size | `POST .../getPRsSize/...` | `POST .../getMRsSize/...` |
| Cycle time | `POST .../getGitCycleTime/...` | `POST .../getGitLabCycleTime/...` |
| Approval | `POST .../getApprovalRate/...` | `POST .../getMRsApprovalRate/...` |
| Iteration | `POST .../getPRsIterationTime/...` | `POST .../getMRsIterationTime/...` |
| Lead time | `POST .../getLeadTime/...` | (via analytics) |
| DORA | `GET .../getDoraMetrics/...` | — |

### Supporting

| Endpoint | Helper |
|----------|--------|
| `GET /api/github/getAllRepo/{companyId}/{projectId}/{boardId}` | `getRepoList` |

### Load order

1. `getGitData`  
2. Parallel: PM, CXO, Standup

---

## 7. Standup — `/standUp`

**File:** `StandUpPage.jsx`

### Primary APIs

| Endpoint | Helper | Role |
|----------|--------|------|
| `GET /api/analytics/getStandupData/...` | `getStandupDashboardData` | Priority on sprint change |
| `GET /api/analytics/getProjectManagementData/...` | `getProjectManagementData` | Burndown, QA, user list, hours |

### Standup sections

| Section | Redux | UI |
|---------|-------|-----|
| `jiraData` | `setJiraTableData` | Jira AG Grid |
| `jiraStatusByDev` | `setJiraStatusByDeveloper` | Per-developer status |
| `standupBurndown` | `setStandupBurndown` | Standup burndown |
| `openPRs` | `setStandupOpenPRsData` | Open PRs |
| `mergedWithoutReview` | `setStandupMergedPRsData` | Merged without review |
| `storyChurn` | `setStoryChurnData` | Story churn |
| `storyChurnExcludingBugs` | `setStoryChurnData` | Churn excluding bugs |
| `dailyBurnup` | `setDailyBurnup` | Burnup (sprint only) |

Churn toggle refetches: `getStandupDashboardData({ sections: 'storyChurn' | 'storyChurnExcludingBugs' })`.

### PM sections on Standup (examples)

Developer change: `userList,actualStoryPoints,burndownData,availableHours,burndownVelocity,qaInsightsBugs,qaInsightsTests`

Team change: adds `taskCount,storyPointData,qaReference` + `fetchCXODashboardData(..., 'cxoData')`

### Legacy standup routes

| Endpoint | Helper |
|----------|--------|
| `GET /api/standup/jiraData/...` | `getjiraTableData` |
| `GET /api/standup/getStoryChurn/...` | `getStoryChurnData` |
| `GET /api/standup/getStoryChurnExcludingBugs/...` | `getStoryChurnExcludingBugs` |
| `GET /api/standup/jira-status-by-dev/...` | `fetchJiraStatusByDeveloper` |
| `GET /api/standup/getStandupBurndown/...` | `getStandupBurndown` |
| `GET /api/standup/qa-insights/bugs/...` | `getQAInsightsBugs` |
| `GET /api/standup/qa-insights/tests/...` | `getQAInsightsTests` |
| `GET /api/standup/getQARefrence/...` | `getQARefrence` |

### Related Jira

| Endpoint | Helper |
|----------|--------|
| `GET /api/jira/getDailyBurnup/...` | `getDailyBurnup` |
| `GET /api/jira/getBurndownVelocity/...` | `getBurndownVelocity` |
| `GET /api/jira/getDevAvailableHours/...` | `getAvailableHours` |

### Load order

1. `getStandupData`  
2. Parallel: PM, CXO, optional Git

---

## 8. Tech Quality — `/techQuality`

**File:** `TechQuality.jsx`  
**Slice:** `techQualitySlice.jsx`

### Dedicated API

| Endpoint | Method | Helper |
|----------|--------|--------|
| `/api/techQuality/getTechQualityMetrics/{companyId}/{projectId}/{boardId}` | GET | `getTechQualityMetrics` |

Board/project scoped (no sprint/release query).

---

## 9. Release — `/release`

**File:** `ReleaseDashboard.jsx`  
**Slice:** `releaseDashboardSlice.jsx`

### Dedicated API

| Endpoint | Method | Helper |
|----------|--------|--------|
| `/api/releaseDashboard/releaseData/{companyId}/{projectId}/{boardId}?releaseId={releaseId}` | GET | `getReleaseDashboardData` |

Returns: burnup, burndown forecast, accuracy, investment profile, risk alerts (from synced `JiraRelease` document).

### Supporting

| Endpoint | Helper |
|----------|--------|
| `GET /api/jira/getReleases/...` | `getReleaseDetails` |
| `GET /api/jira/getBoardList/...` | `getBoardList` |
| `GET /api/company/getAllOrgs/...` | `getAllOrgsListAPI` |

---

## 10. Integration — `/integration`

| Endpoint | Method | Helper | Purpose |
|----------|--------|--------|---------|
| `/api/connection/add/{companyId}` | POST | `integration` | Save integration |
| `/api/connection/clickup/previewTeams/{companyId}` | POST | — | ClickUp workspace preview |
| `/api/jira/getProjectList/{companyId}` | GET | `getProjectList` | List projects |
| `/api/jira/updateSelectedProject/{companyId}` | POST | `updateSelectedProject` | Active projects |
| `/api/jira/updateHideProject/{companyId}` | POST | `updateHideProject` | Hidden projects |
| `/api/github-issues/userProjects/{companyId}` | GET | `getGithubIssuesUserProjects` | GitHub Issues projects |
| `/api/github-issues/updateSelectedProject/{companyId}` | POST | `updateGithubIssuesSelectedProject` | Select GitHub Issues projects |

---

## 11. Capacity Planning

**Routes:** `/capacityPlanning`, `/Roles&Billing`, `/HolidayList`

| Endpoint | Method | Helper |
|----------|--------|--------|
| `GET /api/analytics/getProjectManagementData/...?sections=userList` | GET | `getProjectManagementData` |
| `GET ...?sections=jiraData` | GET | `getProjectManagementData` |
| `GET /api/jira/getUserList/...` | GET | `getUserList` |
| `GET /api/jira/getRoleRatesAndStoryPoints/{companyId}` | GET | `getRoleRatesAndStoryPoints` |
| `POST /api/jira/addRoleRates/{companyId}` | POST | `addRoleRates` |
| `POST /api/jira/addStoryPoints/{companyId}` | POST | `addStoryPoints` |
| `POST /api/jira/addCapacity/{companyId}` | POST | `addCapacity` |
| `GET /api/jira/getHolidayList/{companyId}` | GET | `getHolidayList` |
| `POST /api/jira/addHolidayList/{companyId}` | POST | `addHolidayList` |
| `GET /api/jira/getJiraUsers/{companyId}` | GET | `getJiraUsers` |
| `GET /api/jira/getUserData/{companyId}/{projectId}` | GET | `getUserData` |
| `GET /api/jira/getStoryPoints/{companyId}` | GET | `getStoryPoints` |

---

## 12. Cross-dashboard shared APIs

| Endpoint | Method | Where | Purpose |
|----------|--------|-------|---------|
| `/api/user/login` | POST | Login | Authentication |
| `/api/user/register` | POST | Register | Sign up |
| `/api/user/forgotpassword` | POST | Forgot password | Reset email |
| `/api/user/resetpassword/{token}` | POST | Reset password | New password |
| `/api/company/add` | POST | Add company | Onboarding |
| `/api/company/syncCompanyData/{companyId}` | GET | Header | Full sync |
| `/api/company/syncCompanyData/{companyId}?projectId=` | GET | Header | Project sync |
| `/api/company/getAllOrgs/{companyId}` | GET | Filters | Organizations |
| `/api/jira/getSyncStatus/{companyId}` | GET | — | Sync state |
| `/api/jira/getLastSynced/{companyId}/{projectId}` | GET | Header | Last sync time |
| `/api/jira/getProjectList/{companyId}` | GET | Many | Projects |
| `/api/jira/getBoardList/{companyId}/{projectId}` | GET | Many | Boards |
| `/api/jira/getSprintList/...` | GET | Filters | Sprints |
| `/api/jira/getReleases/...` | GET | Filters | Releases |

---

## 13. Route → API load priority

When sprint/release changes (`commonFunctions.js`):

| Current path | First (priority) | Then (background) |
|--------------|------------------|---------------------|
| `/dashboard` | `getCXOData` | PM, Standup, Git (if repo) |
| `/jiraDashboard` | `getProjectManagementData` | CXO, Standup, Git (if repo) |
| `/standUp` | `getStandupData` | PM, CXO, Git (if repo) |
| `/gitDashboard` | `getGitData` | PM, CXO, Standup |
| Other | All in parallel | — |

---

## 14. Code references

| Topic | Path |
|-------|------|
| UI API wrappers | `QMetrix-UI/src/constants.js` |
| Load orchestration | `QMetrix-UI/src/utils/commonFunctions.js` |
| HTTP client | `QMetrix-UI/src/axiosInstance.js` |
| API route mount | `QMetrix-API/src/modules/index.js` |
| Analytics controller | `QMetrix-API/src/modules/analytics/controllers/dashboardController.js` |
| Standup routes | `QMetrix-API/src/modules/stand-up-management/route.js` |
| Jira routes | `QMetrix-API/src/modules/project-management/jira/route.js` |
| GitHub / GitLab | `QMetrix-API/src/modules/source-code-management/github/route.js`, `gitlab/route.js` |
| CXO | `QMetrix-API/src/modules/cxo/route.js` |
| Swagger | `QMetrix-API/src/swagger.js` |

---

## 15. Export to PDF

### Option A — VS Code / Cursor

1. Open this file in the editor.  
2. Install **Markdown PDF** (or similar) extension.  
3. Run “Markdown PDF: Export (pdf)”.

### Option B — Pandoc (command line)

From the repo root:

```powershell
cd d:\Qmterix\Qmetrix_Dec
pandoc docs/API-BY-DASHBOARD.md -o docs/API-BY-DASHBOARD.pdf --toc -V geometry:margin=1in
```

### Option C — Browser

1. Push or open the `.md` in GitHub/GitLab — use Print → Save as PDF.  
2. Or use any Markdown preview → Print to PDF.

---

*Generated for the QMetrix Dec workspace. For interactive API exploration, run the API and open Swagger UI (see `QMetrix-API` server configuration).*
