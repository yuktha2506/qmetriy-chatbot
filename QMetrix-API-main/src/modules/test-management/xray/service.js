import axios from 'axios';
import { ConnectionModel } from '../../connection/model.js';
import { XrayProjectModel, XrayExecutionModel } from './model.js';
import { ProjectModel, SprintModel, JiraReleaseModel } from '../../project-management/jira/model.js';
import { cryptoHandler } from '../../../utils/commonFunctions.js';
import { PROVIDER_NAME_JIRA } from '../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED } from '../../../utils/constants/statusConstants.js';

class XrayService {
    async syncXrayCloud(companyId, tenantConnection, projectKey, syncType = 'hard') {
        
        if (!companyId || !projectKey) {
            throw new Error('companyId and projectKey are required');
        }

        const Connection = ConnectionModel(tenantConnection);
        const XrayProject = XrayProjectModel(tenantConnection);
        const XrayExecution = XrayExecutionModel(tenantConnection);
        const xrayCred = await Connection.findOne({ companyId, name: 'Xray Cloud' });
        const jiraCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_JIRA });

        const cred = xrayCred || jiraCred;
        if (!cred) {
            throw new Error('Xray credentials not found for this company');
        }

        const clientId = cred.username;
        const clientSecret = cryptoHandler(cred.password, 'decrypt');
        const cloudHost = 'https://xray.cloud.getxray.app';
        const isCloud = !!(cred.host && cred.host.includes('xray.cloud'));
        const host = isCloud ? cred.host : cloudHost;
        let serverHost = cred.xrayServerHost || cred.serverHost || (!isCloud ? cred.host : null);
        let serverAuthHeader =
            (cred.username || jiraCred?.username) && (cred.password || jiraCred?.password)
                ? `Basic ${Buffer.from(`${cred.username || jiraCred.username}:${clientSecret || cryptoHandler(jiraCred?.password || '', 'decrypt')}`).toString('base64')}`
                : null;

        const { jiraHost, jiraAuthHeader } = this.resolveJiraAuth({
            primaryCred: cred,
            jiraCred,
        });

        // If cloud is used but server/DC is available via Jira host, set as fallback
        if (!serverHost && jiraHost) {
            serverHost = jiraHost;
        }
        if (!serverAuthHeader && jiraAuthHeader && serverHost) {
            serverAuthHeader = jiraAuthHeader;
        }

        const token = await this.getXrayToken(host, clientId, clientSecret);

        await this.upsertProject(XrayProject, companyId, projectKey, jiraHost, jiraAuthHeader, tenantConnection);

        let executions = [];
        try {
            executions = await this.fetchTestExecutions(host, token, projectKey);
        } catch (err) {
            if (!executions.length && serverHost && serverAuthHeader) {
                try {
                    executions = await this.fetchTestExecutionsServer(serverHost, serverAuthHeader, projectKey);
                } catch (srvErr) {
                    // Ignore server/DC error, will try Jira fallback
                }
            }
            if (jiraHost && jiraAuthHeader) {
                try {
                    executions = await this.fetchExecutionsViaJiraSearch({ jiraHost, jiraAuthHeader, projectKey });
                } catch (jiraErr) {
                    // Ignore Jira error
                }
            }
            if (!executions.length) {
                throw err;
            }
        }

        const detailedExecutions = await this.enrichWithJiraFields({
            executions,
            jiraHost,
            jiraAuthHeader,
        });

        // Always try to enrich executions with tests using Xray API if we have a token,
        // even when executions themselves came from the Jira fallback.
        const executionsWithTests = await this.attachTests({
            host,
            token,
            executions: detailedExecutions,
            serverHost,
            serverAuthHeader,
            jiraHost,
            jiraAuthHeader,
        });

        const mapped = await this.mapExecutions({
            executions: executionsWithTests,
            companyId,
            projectKey,
            tenantConnection,
            jiraHost,
            jiraAuthHeader,
        });

        const planAndSetExecutions = await this.syncTestContainers({
            host,
            token,
            projectKey,
            jiraHost,
            jiraAuthHeader,
            companyId,
            tenantConnection,
        });

        const allMappedExecutions = [...mapped, ...planAndSetExecutions];

        if (!allMappedExecutions.length) {
            return { upserted: 0, matched: 0 };
        }

        // Filter executions based on sync type
        let filteredExecutions = allMappedExecutions;
        if (syncType === 'light') {
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);

            // Fetch active sprints and unreleased releases
            const activeSprints = await Sprint.find({ companyId, state: STATUS_ACTIVE }).lean();
            const unreleasedReleases = await JiraRelease.find({ companyId, status: RELEASE_STATUS_UNRELEASED }).lean();

            const activeSprintIds = new Set(activeSprints.map((s) => s._id.toString()));
            const unreleasedReleaseIds = new Set(unreleasedReleases.map((r) => r._id.toString()));

            // Filter executions: keep only those with active sprints or unreleased releases
            filteredExecutions = allMappedExecutions.filter((exec) => {
                const sprintIds = Array.isArray(exec.sprintId) ? exec.sprintId : [exec.sprintId];
                
                for (const sid of sprintIds) {
                    if (sid && activeSprintIds.has(sid.toString())) {
                        return true;
                    }
                }
                if (exec.releaseId && unreleasedReleaseIds.has(exec.releaseId.toString())) {
                    return true;
                }
                return false;
            });
        }
        if (!filteredExecutions.length) {
            return { upserted: 0, matched: 0 };
        }

        const ops = filteredExecutions.map((doc) => ({
            updateOne: {
                filter: { companyId, projectKey, testExecKey: doc.testExecKey },
                update: { $set: doc },
                upsert: true,
            },
        }));
        
        try {
            const result = await XrayExecution.bulkWrite(ops, { ordered: false });
            return {
                upserted: result.upsertedCount || 0,
                matched: result.matchedCount || 0,
            };
        } catch (error) {
            console.error('[XRAY SYNC] Bulk write error:', error.message);
            console.error('[XRAY SYNC] Sample operation:', JSON.stringify(ops[0], null, 2));
            throw error;
        }
    }

    async syncTestContainers({ host, token, projectKey, jiraHost, jiraAuthHeader, companyId, tenantConnection }) {
        const [plans, sets] = await Promise.all([
            this.fetchAndMapContainer({
                host,
                token,
                projectKey,
                jiraHost,
                jiraAuthHeader,
                companyId,
                tenantConnection,
                containerType: 'plan',
            }),
            this.fetchAndMapContainer({
                host,
                token,
                projectKey,
                jiraHost,
                jiraAuthHeader,
                companyId,
                tenantConnection,
                containerType: 'set',
            }),
        ]);
        return [...plans, ...sets];
    }

    async fetchAndMapContainer({
        host,
        token,
        projectKey,
        jiraHost,
        jiraAuthHeader,
        companyId,
        tenantConnection,
        containerType,
    }) {
        try {
            let containers = [];
            try {
                if (containerType === 'plan') {
                    containers = await this.fetchTestPlans(host, token, projectKey);
                } else {
                    containers = await this.fetchTestSets(host, token, projectKey);
                }
            } catch (err) {
                // ignore and fallback to Jira search
            }

            if (!containers.length && jiraHost && jiraAuthHeader) {
                try {
                    if (containerType === 'plan') {
                        containers = await this.fetchPlansViaJiraSearch({ jiraHost, jiraAuthHeader, projectKey });
                    } else {
                        containers = await this.fetchSetsViaJiraSearch({ jiraHost, jiraAuthHeader, projectKey });
                    }
                } catch (jiraErr) {
                    containers = [];
                }
            }

            if (!containers.length) {
                return [];
            }

            const tagged = containers.map((container) => ({
                ...container,
                _sourceType: containerType,
            }));

            const detailedContainers = await this.enrichWithJiraFields({
                executions: tagged,
                jiraHost,
                jiraAuthHeader,
            });

            const withTests = await this.attachTestsToContainers({
                host,
                token,
                containers: detailedContainers,
                jiraHost,
                jiraAuthHeader,
                fetchTests:
                    containerType === 'plan'
                        ? this.fetchTestsForPlan.bind(this)
                        : this.fetchTestsForSet.bind(this),
            });

            return this.mapExecutions({
                executions: withTests,
                companyId,
                projectKey,
                tenantConnection,
                jiraHost,
                jiraAuthHeader,
            });
        } catch (err) {
            return [];
        }
    }

    async getXrayToken(host, clientId, clientSecret) {
        const url = `${host}/api/v2/authenticate`;
        const res = await axios.post(url, { client_id: clientId, client_secret: clientSecret }, { headers: { 'Content-Type': 'application/json' } });
        return res.data;
    }

    async fetchTestExecutions(host, token, projectKey) {
        // For Xray Cloud, use GraphQL; server/DC handled elsewhere
        const url = `${host}/api/v2/graphql`;
        const limit = 100;
        let offset = 0;
        const all = [];
        let hasMore = true;
        while (hasMore) {
            const query = `
                query {
                    getTestExecutions(jql: "project = '${projectKey}'", limit: ${limit}, start: ${offset}) {
                        total
                        results {
                            issueId
                            jira(fields: ["key","summary","created"])
                        }
                    }
                }
            `;
            const res = await axios.post(url, { query }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
            const results = res.data?.data?.getTestExecutions?.results || [];
            all.push(
                ...results.map((r) => ({
                    key: r.jira?.key,
                    testExecKey: r.jira?.key,
                    _jiraId: r.issueId,
                    summary: r.jira?.summary,
                    created: r.jira?.created,
                }))
            );
            hasMore = results.length === limit;
            if (hasMore) {
                offset += limit;
            }
        }
        return all;
    }

    async fetchTestPlans(host, token, projectKey) {
        const url = `${host}/api/v2/graphql`;
        const limit = 100;
        let offset = 0;
        const all = [];
        let hasMore = true;
        while (hasMore) {
            const query = `
                query {
                    getTestPlans(jql: "project = '${projectKey}'", limit: ${limit}, start: ${offset}) {
                        total
                        results {
                            issueId
                            jira(fields: ["key","summary","created"])
                        }
                    }
                }
            `;
            const res = await axios.post(url, { query }, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            const results = res.data?.data?.getTestPlans?.results || [];
            all.push(
                ...results.map((r) => ({
                    key: r.jira?.key,
                    _jiraId: r.issueId,
                    summary: r.jira?.summary,
                    created: r.jira?.created,
                }))
            );
            hasMore = results.length === limit;
            if (hasMore) {
                offset += limit;
            }
        }
        return all;
    }

    async fetchTestSets(host, token, projectKey) {
        const url = `${host}/api/v2/graphql`;
        const limit = 100;
        let offset = 0;
        const all = [];
        let hasMore = true;
        while (hasMore) {
            const query = `
                query {
                    getTestSets(jql: "project = '${projectKey}'", limit: ${limit}, start: ${offset}) {
                        total
                        results {
                            issueId
                            jira(fields: ["key","summary","created"])
                        }
                    }
                }
            `;
            const res = await axios.post(url, { query }, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            const results = res.data?.data?.getTestSets?.results || [];
            all.push(
                ...results.map((r) => ({
                    key: r.jira?.key,
                    _jiraId: r.issueId,
                    summary: r.jira?.summary,
                    created: r.jira?.created,
                }))
            );
            hasMore = results.length === limit;
            if (hasMore) {
                offset += limit;
            }
        }
        return all;
    }

    async fetchTestExecutionsServer(host, authHeader, projectKey) {
        const url = `${host}/rest/raven/1.0/api/testexec?projectKey=${encodeURIComponent(projectKey)}`;
        const res = await axios.get(url, {
            headers: { Authorization: authHeader },
        });
        const items = res.data?.testexecs || res.data?.results || (Array.isArray(res.data) ? res.data : []);
        return Array.isArray(items) ? items : [];
    }

    async fetchExecutionsViaJiraSearch({ jiraHost, jiraAuthHeader, projectKey }) {
        const url = `${jiraHost}/rest/api/3/search/jql`;
        const body = {
            jql: `project = "${projectKey}" AND issuetype = "Test Execution"`,
            fields: ['summary', 'status', 'created', 'resolutiondate', 'fixVersions', 'customfield_10020', 'project'],
            maxResults: 500,
        };
        const res = await axios.post(url, body, {
            headers: {
                Authorization: jiraAuthHeader,
                'Content-Type': 'application/json',
            },
        });
        return res.data?.issues || [];
    }

    async fetchPlansViaJiraSearch({ jiraHost, jiraAuthHeader, projectKey }) {
        const url = `${jiraHost}/rest/api/3/search/jql`;
        const body = {
            jql: `project = "${projectKey}" AND issuetype = "Test Plan"`,
            fields: ['summary', 'status', 'created', 'resolutiondate', 'fixVersions', 'customfield_10020', 'project'],
            maxResults: 500,
        };
        const res = await axios.post(url, body, {
            headers: {
                Authorization: jiraAuthHeader,
                'Content-Type': 'application/json',
            },
        });
        return res.data?.issues || [];
    }

    async fetchSetsViaJiraSearch({ jiraHost, jiraAuthHeader, projectKey }) {
        const url = `${jiraHost}/rest/api/3/search/jql`;
        const body = {
            jql: `project = "${projectKey}" AND issuetype = "Test Set"`,
            fields: ['summary', 'status', 'created', 'resolutiondate', 'fixVersions', 'customfield_10020', 'project'],
            maxResults: 500,
        };
        const res = await axios.post(url, body, {
            headers: {
                Authorization: jiraAuthHeader,
                'Content-Type': 'application/json',
            },
        });
        return res.data?.issues || [];
    }

    async fetchProjectUsers(jiraHost, jiraAuthHeader, projectKey) {
        try {
            // Fetch users with access to the project (assignable users)
            const url = `${jiraHost}/rest/api/3/user/assignable/search`;
            const res = await axios.get(url, {
                headers: { Authorization: jiraAuthHeader },
                params: {
                    project: projectKey,
                    maxResults: 1000,
                },
            });

            const users = (res.data || []).map((user) => ({
                accountId: user.accountId,
                email: user.emailAddress || null,
                displayName: user.displayName,
                active: user.active !== false,
                accountType: user.accountType || 'atlassian',
            }));

            return users;
        } catch (err) {
            return [];
        }
    }

    async upsertProject(XrayProject, companyId, projectKey, jiraHost, jiraAuthHeader, tenantConnection) {
        try {
            let jiraProjectId = null;
            let name = projectKey;
            let url = jiraHost ? `${jiraHost}/browse/${projectKey}` : null;
            let users = [];

            const Project = ProjectModel(tenantConnection);
            const project = await Project.findOne({ 
                companyId, 
                'boards.boardLocation.projectKey': projectKey 
            }).select('_id name').lean();
            
            if (project && project._id) {
                jiraProjectId = project._id;
                name = project.name || name;
            }

            if (jiraHost && jiraAuthHeader) {
                try {
                    const res = await axios.get(`${jiraHost}/rest/api/3/project/${projectKey}`, {
                        headers: { Authorization: jiraAuthHeader, 'Content-Type': 'application/json' },
                    });
                    if (!project) {
                        name = res.data?.name || name;
                    }
                    url = res.data?.self || url;
                } catch (innerErr) {
                    // Ignore Jira fetch error
                }

                // Fetch users for the project
                users = await this.fetchProjectUsers(jiraHost, jiraAuthHeader, projectKey);
            }

            const doc = {
                companyId,
                projectKey,
                jiraProjectId,
                name,
                url,
                users,
            };
            await XrayProject.updateOne({ companyId, projectKey }, { $set: doc }, { upsert: true });
        } catch (err) {
            // Ignore upsert error
        }
    }

    async attachTests({ host, token, executions, serverHost, serverAuthHeader, jiraHost, jiraAuthHeader }) {
        const enriched = [];
        for (const exec of executions) {
            const key = exec.key || exec.testExecKey || exec.id || '';
            if (!key) {
                enriched.push(exec);
                continue;
            }

            let finalTests = [];

            try {
                // Try Cloud GraphQL endpoints first (prefer numeric issueId when available)
                if (exec._jiraId) {
                    // Try fetching test runs FIRST (this has execution status: PASSED, FAILED, TO DO)
                    try {
                        const runs = await this.fetchTestRunsForExecution(host, token, {
                            testExecKey: key,
                            testExecId: exec._jiraId,
                        });
                        if (runs && runs.length) {
                            finalTests = runs;
                        }
                    } catch (runErr) {
                        // Ignore run fetch error, will try fallback
                    }

                    // If testRuns failed, fallback to tests endpoint (metadata only, no status)
                    if (!finalTests.length) {
                        try {
                            const tests = await this.fetchTestsForExecution(host, token, exec._jiraId);
                            if (tests && tests.length) {
                                finalTests = tests;
                            }
                        } catch (testErr) {
                            // Ignore test fetch error
                        }
                    }
                }

                // Fallback to Server/DC endpoints
                if (!finalTests.length && serverHost && serverAuthHeader) {
                    try {
                        const serverTests = await this.fetchTestsForExecutionServer(serverHost, serverAuthHeader, key);
                        if (serverTests && serverTests.length) {
                            finalTests = serverTests;
                        }
                    } catch (srvErr) {
                        // Ignore server/DC tests error
                    }

                    if (!finalTests.length) {
                        try {
                            const serverRuns = await this.fetchTestRunsForExecutionServer(serverHost, serverAuthHeader, key);
                            if (serverRuns && serverRuns.length) {
                                finalTests = serverRuns;
                            }
                        } catch (srvRunErr) {
                            // Ignore server/DC runs error
                        }
                    }
                }

                // Final fallback to Jira linked issues (metadata only)
                if (!finalTests.length && jiraHost && jiraAuthHeader) {
                    try {
                        const jiraTests = await this.fetchTestsFromJiraLinked(jiraHost, jiraAuthHeader, key);
                        if (jiraTests && jiraTests.length) {
                            finalTests = jiraTests;
                        }
                    } catch (jiraTestsErr) {
                        // Ignore Jira tests error
                    }
                }

                exec.tests = finalTests;
            } catch (err) {
                exec.tests = [];
            }

            enriched.push(exec);
        }
        return enriched;
    }

    async attachTestsToContainers({ host, token, containers, jiraHost, jiraAuthHeader, fetchTests }) {
        const enriched = [];
        for (const container of containers) {
            const key = container.key || container.testExecKey || container.id || '';
            if (!key) {
                enriched.push(container);
                continue;
            }

            let finalTests = [];

            try {
                if (container._jiraId) {
                    try {
                        const tests = await fetchTests(host, token, container._jiraId);
                        if (tests && tests.length) {
                            finalTests = tests;
                        }
                    } catch (testErr) {
                        // Ignore test fetch error
                    }
                }

                if (!finalTests.length) {
                    try {
                        const tests = await fetchTests(host, token, key);
                        if (tests && tests.length) {
                            finalTests = tests;
                        }
                    } catch (testErr) {
                        // Ignore test fetch error
                    }
                }

                if (!finalTests.length && jiraHost && jiraAuthHeader) {
                    try {
                        const jiraTests = await this.fetchTestsFromJiraLinked(jiraHost, jiraAuthHeader, key);
                        if (jiraTests && jiraTests.length) {
                            finalTests = jiraTests;
                        }
                    } catch (jiraTestsErr) {
                        // Ignore Jira tests error
                    }
                }

                container.tests = finalTests;
            } catch (err) {
                container.tests = [];
            }

            enriched.push(container);
        }
        return enriched;
    }

    async fetchTestsForExecution(host, token, issueIdOrKey) {
        const url = `${host}/api/v2/graphql`;
        const limit = 100;
        let offset = 0;
        const all = [];

        let hasMore = true;
        while (hasMore) {
            const query = `
                query {
                    getTestExecution(issueId: "${issueIdOrKey}") {
                        tests(limit: ${limit}, start: ${offset}) {
                            total
                            results {
                                issueId
                                jira(fields: ["key","summary"])
                                testType { name kind }
                            }
                        }
                    }
                }
            `;
            const res = await axios.post(url, { query }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
            const results = res.data?.data?.getTestExecution?.tests?.results || [];
            all.push(
                ...results.map((t) => ({
                    id: t.issueId,
                    key: t.jira?.key,
                    name: t.jira?.summary,
                    summary: t.jira?.summary,
                    type: t.testType?.kind || t.testType?.name,
                }))
            );
            hasMore = results.length === limit;
            if (hasMore) {
                offset += limit;
            }
        }
        return all;
    }

    async fetchTestsForPlan(host, token, issueIdOrKey) {
        const url = `${host}/api/v2/graphql`;
        const limit = 100;
        let offset = 0;
        const all = [];

        let hasMore = true;
        while (hasMore) {
            const query = `
                query {
                    getTestPlan(issueId: "${issueIdOrKey}") {
                        tests(limit: ${limit}, start: ${offset}) {
                            total
                            results {
                                issueId
                                jira(fields: ["key","summary"])
                                testType { name kind }
                            }
                        }
                    }
                }
            `;
            const res = await axios.post(url, { query }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
            const results = res.data?.data?.getTestPlan?.tests?.results || [];
            all.push(
                ...results.map((t) => ({
                    id: t.issueId,
                    key: t.jira?.key,
                    name: t.jira?.summary,
                    summary: t.jira?.summary,
                    type: t.testType?.kind || t.testType?.name,
                }))
            );
            hasMore = results.length === limit;
            if (hasMore) {
                offset += limit;
            }
        }
        return all;
    }

    async fetchTestsForSet(host, token, issueIdOrKey) {
        const url = `${host}/api/v2/graphql`;
        const limit = 100;
        let offset = 0;
        const all = [];

        let hasMore = true;
        while (hasMore) {
            const query = `
                query {
                    getTestSet(issueId: "${issueIdOrKey}") {
                        tests(limit: ${limit}, start: ${offset}) {
                            total
                            results {
                                issueId
                                jira(fields: ["key","summary"])
                                testType { name kind }
                            }
                        }
                    }
                }
            `;
            const res = await axios.post(url, { query }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
            const results = res.data?.data?.getTestSet?.tests?.results || [];
            all.push(
                ...results.map((t) => ({
                    id: t.issueId,
                    key: t.jira?.key,
                    name: t.jira?.summary,
                    summary: t.jira?.summary,
                    type: t.testType?.kind || t.testType?.name,
                }))
            );
            hasMore = results.length === limit;
            if (hasMore) {
                offset += limit;
            }
        }
        return all;
    }

    async fetchTestsForExecutionServer(host, authHeader, testExecKey) {
        const url = `${host}/rest/raven/1.0/api/testexec/${encodeURIComponent(testExecKey)}/test`;
        const res = await axios.get(url, {
            headers: { Authorization: authHeader },
        });
        const items = res.data?.tests || (Array.isArray(res.data) ? res.data : []);
        return Array.isArray(items) ? items : [];
    }

    async fetchTestRunsForExecution(host, token, { testExecKey, testExecId }) {
        const url = `${host}/api/v2/graphql`;
        
        // Try with numeric ID first, then fall back to key
        const attempts = [];
        if (testExecId) {
            attempts.push({ identifier: testExecId, type: 'numeric ID' });
        }
        if (testExecKey) {
            attempts.push({ identifier: testExecKey, type: 'key' });
        }
        
        for (const attempt of attempts) {
            try {
                const allRuns = [];
                let start = 0;
                const limit = 100;
                let hasMore = true;
                let totalCount = 0;
                
                while (hasMore) {
                    const query = `
                        query {
                            getTestExecution(issueId: "${attempt.identifier}") {
                                issueId
                                jira(fields: ["key"])
                                testRuns(limit: ${limit}, start: ${start}) {
                                    total
                                    results {
                                        id
                                        status { 
                                            name
                                            description
                                            color
                                        }
                                        finishedOn
                                        startedOn
                                        test {
                                            issueId
                                            jira(fields: ["key","summary"])
                                            testType { kind name }
                                        }
                                    }
                                }
                            }
                        }
                    `;
                    
                    const res = await axios.post(url, { query }, { 
                        headers: { 
                            Authorization: `Bearer ${token}`, 
                            'Content-Type': 'application/json' 
                        } 
                    });
                    
                    if (res.data?.errors) {
                        break; // Break pagination loop and try next identifier
                    }
                    
                    const runsData = res.data?.data?.getTestExecution?.testRuns;
                    const runs = runsData?.results || [];
                    totalCount = runsData?.total || 0;
                    
                    if (runs.length === 0) {
                        hasMore = false;
                        break;
                    }
                    
                    allRuns.push(...runs);
                    
                    // Check if we've fetched all runs
                    if (allRuns.length >= totalCount || runs.length < limit) {
                        hasMore = false;
                    } else {
                        start += limit;
                    }
                }
                
                if (allRuns.length === 0) {
                    continue;
                }
                
                return allRuns.map((r) => {
                    const test = r.test || {};
                    const key = test.jira?.key || test.key;
                    const statusName = r.status?.name || '';
                    const statusUpper = statusName.toUpperCase();
                    
                    return {
                        id: r.id || test.issueId || key,
                        key,
                        name: test.jira?.summary || '',
                        description: '',
                        status: statusName,
                        type: test.testType?.kind || test.testType?.name || '',
                        is_completed: ['PASSED', 'FAILED', 'BLOCKED', 'DONE'].includes(statusUpper),
                        completed_on: r.finishedOn ? new Date(r.finishedOn) : null,
                        passed_count: statusUpper === 'PASSED' ? 1 : 0,
                        failed_count: statusUpper === 'FAILED' ? 1 : 0,
                        blocked_count: statusUpper === 'BLOCKED' ? 1 : 0,
                        retest_count: 0,
                        untested_count: statusUpper === 'TO DO' || !statusName ? 1 : 0,
                        todo_count: statusUpper === 'TO DO' ? 1 : 0,
                        project_id: test.projectId || test.project_id,
                        manual_percentage: undefined,
                        url: test.url,
                        created_on: r.startedOn ? new Date(r.startedOn) : null,
                        updated_on: r.finishedOn ? new Date(r.finishedOn) : null,
                    };
                });
            } catch (err) {
                // Continue to next attempt
            }
        }
        
        const finalErr = new Error(`Failed to fetch test runs after ${attempts.length} attempts`);
        throw finalErr;
    }

    async fetchTestsFromJiraLinked(jiraHost, jiraAuthHeader, execKey) {
        const jql = `issue in linkedIssues("${execKey}") AND issuetype = "Test"`;
        const url = `${jiraHost}/rest/api/3/search/jql`;
        const body = {
            jql,
            fields: ['summary', 'status', 'issuetype', 'project'],
            maxResults: 200,
        };
        const res = await axios.post(url, body, {
            headers: {
                Authorization: jiraAuthHeader,
                'Content-Type': 'application/json',
            },
        });
        const issues = res.data?.issues || [];
        return issues.map((iss) => ({
            id: iss.id,
            key: iss.key,
            name: iss.fields?.summary || iss.key,
            summary: iss.fields?.summary || '',
            status: iss.fields?.status?.name || '',
            type: iss.fields?.issuetype?.name || '',
            project_id: iss.fields?.project?.id,
        }));
    }

    async fetchTestRunsForExecutionServer(host, authHeader, testExecKey) {
        const limit = 200;
        let offset = 0;
        const all = [];
        let hasMore = true;
        while (hasMore) {
            const url = `${host}/rest/raven/1.0/api/testrun?testExecKey=${encodeURIComponent(testExecKey)}&limit=${limit}&offset=${offset}`;
            try {
                const res = await axios.get(url, {
                    headers: { Authorization: authHeader },
                });
                const items = res.data?.results || res.data?.testRuns || res.data?.tests || (Array.isArray(res.data) ? res.data : []);
                const normalized = (Array.isArray(items) ? items : []).map((r) => {
                    const test = r.test || {};
                    const key = test.key || r.testKey || r.key || r.id;
                    return {
                        id: r.id || test.id || key,
                        key,
                        name: test.summary || test.name || test.fields?.summary || r.name || '',
                        description: test.description || '',
                        status: r.status?.name || r.status || '',
                        type: r.testType || test.testType || test.type || r.type || '',
                        is_completed: r.status ? ['PASSED', 'FAILED', 'DONE'].includes(String(r.status).toUpperCase()) : undefined,
                        completed_on: r.finishedOn ? new Date(r.finishedOn) : null,
                        passed_count: r.status && String(r.status).toLowerCase() === 'passed' ? 1 : 0,
                        failed_count: r.status && String(r.status).toLowerCase() === 'failed' ? 1 : 0,
                        blocked_count: r.status && String(r.status).toLowerCase() === 'blocked' ? 1 : 0,
                        retest_count: 0,
                        untested_count: 0,
                        project_id: test.projectId || test.project_id,
                        manual_percentage: undefined,
                        url: test.url,
                        created_on: test.created || null,
                        updated_on: test.updated || null,
                    };
                });
                all.push(...normalized);
                hasMore = normalized.length === limit;
                if (hasMore) {
                    offset += limit;
                }
            } catch (err) {
                hasMore = false;
            }
        }
        return all;
    }

    resolveJiraAuth({ primaryCred, jiraCred }) {
        const jiraHost = primaryCred?.jiraHost || jiraCred?.host || null;
        const jiraUser = primaryCred?.jiraUsername || jiraCred?.username || (primaryCred?.name === PROVIDER_NAME_JIRA ? primaryCred.username : null);
        const jiraPassEnc = primaryCred?.jiraPassword || jiraCred?.password || (primaryCred?.name === PROVIDER_NAME_JIRA ? primaryCred.password : null);

        if (jiraHost && jiraUser && jiraPassEnc) {
            const jiraPassword = cryptoHandler(jiraPassEnc, 'decrypt');
            const basic = Buffer.from(`${jiraUser}:${jiraPassword}`).toString('base64');
            return { jiraHost, jiraAuthHeader: `Basic ${basic}` };
        }
        return { jiraHost: jiraHost || null, jiraAuthHeader: null };
    }

    async fetchJiraIssue(jiraHost, authHeader, key) {
        const url = `${jiraHost}/rest/api/3/issue/${encodeURIComponent(key)}`;
        const params = {
            fields: ['summary', 'status', 'created', 'resolutiondate', 'fixVersions', 'customfield_10020', 'project', 'issuelinks'],
        };
        const res = await axios.get(url, { params, headers: { Authorization: authHeader } });
        return res.data;
    }

    async enrichWithJiraFields({ executions, jiraHost, jiraAuthHeader }) {
        if (!jiraHost || !jiraAuthHeader) {
            return executions;
        }

        const enriched = [];
        for (const exec of executions) {
            try {
                const issue = await this.fetchJiraIssue(jiraHost, jiraAuthHeader, exec.key || exec.testExecKey || exec);
                const fields = issue.fields || {};
                let storyFields = null;
                let storyKey = null;

                // Look for linked Story issues and fetch the first one to inherit sprint/fixVersion
                const links = Array.isArray(fields.issuelinks) ? fields.issuelinks : [];
                const storyKeys = [];
                for (const link of links) {
                    const linked = link.outwardIssue || link.inwardIssue;
                    if (linked?.key) {
                        storyKeys.push(linked.key);
                    }
                }
                if (storyKeys.length) {
                    storyKey = storyKeys[0];
                    try {
                        const storyIssue = await this.fetchJiraIssue(jiraHost, jiraAuthHeader, storyKey);
                        storyFields = storyIssue?.fields || null;
                    } catch (storyErr) {
                        // Ignore story fetch error
                    }
                }

                exec._jiraFields = fields;
                exec._jiraKey = issue.key;
                exec._jiraProjectId = issue.fields?.project?.id;
                exec._jiraId = issue.id;
                exec._linkedStoryKey = storyKey;
                exec._linkedStoryFields = storyFields;
            } catch {
                // ignore if Jira fetch fails
            }
            enriched.push(exec);
        }
        return enriched;
    }

    async mapExecutions({ executions, companyId, projectKey, tenantConnection, jiraHost, jiraAuthHeader }) {
        const Sprint = SprintModel(tenantConnection);
        const Release = JiraReleaseModel(tenantConnection);
        const Project = ProjectModel(tenantConnection);

        const sprints = await Sprint.find({ companyId }).lean();
        const releases = await Release.find({ companyId }).lean();
        const jiraProject = await Project.findOne({ companyId, key: projectKey }).lean();

        const parseSprintField = (val) => {
            const sprintStrings = Array.isArray(val) ? val : val ? [val] : [];
            const results = [];
            for (const s of sprintStrings) {
                const text = String(s);
                const idMatch = text.match(/id=(\d+)/i);
                const nameMatch = text.match(/name=([^,]+)/i);
                if (idMatch || nameMatch) {
                    results.push({
                        sprintIdNum: idMatch ? Number(idMatch[1]) : undefined,
                        sprintNameVal: nameMatch ? nameMatch[1] : undefined,
                    });
                }
            }
            return results;
        };

        const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const parseSprintFromSummary = (summary) => {
            if (!summary) {
                return {};
            }
            const text = String(summary);
            const projectKeyToken = projectKey ? String(projectKey).trim() : '';
            const hasProjectKey =
                projectKeyToken && text.toLowerCase().includes(projectKeyToken.toLowerCase());

            if (projectKeyToken) {
                const projectSprintPattern = new RegExp(
                    `\\b${escapeRegExp(projectKeyToken)}\\s*sprint\\s*#?(\\d+)\\b`,
                    'i',
                );
                const projectMatch = text.match(projectSprintPattern);
                if (projectMatch) {
                    const num = Number(projectMatch[1]);
                    if (!Number.isNaN(num)) {
                        return {
                            sprintIdNum: num,
                            sprintNameVal: `${projectKeyToken} Sprint ${num}`,
                        };
                    }
                }
            }
            
            // Try multiple sprint patterns
            const patterns = [
                /sprint[:\s]+(\d+)/i,
                /sprint[:\s]+([a-z0-9\-_.]+)/i,
                /\bsprint\s+#?(\d+)/i,
                /\[sprint[:\s]+([^\]]+)\]/i,
            ];
            
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    const sprintValue = match[1].trim();
                    const num = Number(sprintValue);
                    
                    // If it's a pure number, use it as ID
                    if (!Number.isNaN(num) && /^\d+$/.test(sprintValue)) {
                        return {
                            sprintIdNum: num,
                            sprintNameVal: hasProjectKey
                                ? `${projectKeyToken} Sprint ${num}`
                                : `Sprint ${num}`,
                        };
                    } else {
                        // Otherwise, use it as a name
                        return {
                            sprintIdNum: undefined,
                            sprintNameVal: sprintValue,
                        };
                    }
                }
            }
            return {};
        };

        const normalizeSprintName = (name) => String(name || '').trim().toLowerCase();
        const isGenericSprintName = (name) => /^sprint\s*#?\d+$/i.test(String(name || '').trim());

        const pickLatestParsedSprint = (parsedList) => {
            if (!Array.isArray(parsedList) || parsedList.length === 0) {
                return {};
            }
            return parsedList[parsedList.length - 1] || {};
        };

        const pickLatestSprintDoc = (sprintDocs) => {
            if (!Array.isArray(sprintDocs) || sprintDocs.length === 0) {
                return null;
            }
            return [...sprintDocs].sort((a, b) => {
                const aDate = new Date(a.startDate || a.completeDate || a.endDate || 0).getTime();
                const bDate = new Date(b.startDate || b.completeDate || b.endDate || 0).getTime();
                return bDate - aDate;
            })[0];
        };

        const findSprint = (fields, exec, storyFields) => {
            // Priority 1: Check execution ticket's sprint field directly
            const sprintField =
                fields?.customfield_10020 ||
                fields?.sprint ||
                exec?.customfield_10020 ||
                exec?.sprint;
            
            let parsedSprints = parseSprintField(sprintField);

            // Priority 2: If not found in execution, check execution ticket's summary
            if (parsedSprints.length === 0) {
                const fromExecSummary = parseSprintFromSummary(exec.summary || fields.summary);
                if (fromExecSummary.sprintIdNum || fromExecSummary.sprintNameVal) {
                    parsedSprints = [fromExecSummary];
                }
            }

            // Priority 3: If still not found, check linked issue's sprint field
            if (parsedSprints.length === 0 && storyFields) {
                const storySprintField = storyFields?.customfield_10020 || storyFields?.sprint;
                parsedSprints = parseSprintField(storySprintField);
            }

            // Priority 4: If still not found, check linked issue's summary
            if (parsedSprints.length === 0 && storyFields?.summary) {
                const fromStorySummary = parseSprintFromSummary(storyFields.summary);
                if (fromStorySummary.sprintIdNum || fromStorySummary.sprintNameVal) {
                    parsedSprints = [fromStorySummary];
                }
            }

            const sprintIdNums = parsedSprints
                .map((s) => s.sprintIdNum)
                .filter((sprintIdNum) => sprintIdNum !== undefined && sprintIdNum !== null);
            const sprintNameVals = parsedSprints
                .map((s) => s.sprintNameVal)
                .filter((sprintNameVal) => sprintNameVal);

            const projectSprints = jiraProject?._id
                ? sprints.filter((s) => String(s.projectId) === String(jiraProject._id))
                : sprints;

            // Find ALL matching sprints (same sprint can exist in multiple boards)
            let matchingSprints = [];
            const matchesById = new Map();
            const addMatch = (s) => {
                if (s && s._id) {
                    matchesById.set(String(s._id), s);
                }
            };
            
            if (sprintIdNums.length > 0) {
                const byId = projectSprints.filter((s) => sprintIdNums.includes(s.sprintId));
                if (byId.length > 0) {
                    byId.forEach(addMatch);
                }
            }
            
            if (matchesById.size === 0 && sprintNameVals.length > 0) {
                const normalizedNames = sprintNameVals.map(normalizeSprintName).filter(Boolean);
                for (const name of normalizedNames) {
                    const exact = projectSprints.filter(
                        (s) => normalizeSprintName(s.name || s.sprintName) === name,
                    );
                    exact.forEach(addMatch);
                }
                if (matchesById.size === 0) {
                    for (const name of normalizedNames) {
                        if (isGenericSprintName(name)) {
                            continue;
                        }
                        const partial = projectSprints.filter((s) => {
                            const sprintName = normalizeSprintName(s.name || s.sprintName);
                            return sprintName && (sprintName.includes(name) || name.includes(sprintName));
                        });
                        if (partial.length === 1) {
                            addMatch(partial[0]);
                        }
                    }
                }
            }
            
            matchingSprints = Array.from(matchesById.values());

            if (
                parsedSprints.length > 1 &&
                matchingSprints.length > 0 &&
                matchingSprints.length < parsedSprints.length
            ) {
                const latest = pickLatestSprintDoc(matchingSprints);
                matchingSprints = latest ? [latest] : matchingSprints;
            }
            
            return { sprintDocs: matchingSprints };
        };

        const parseFixVersionFromSummary = (summary) => {
            if (!summary) {
                return null;
            }
            //try multiple release name patterns
            const patterns = [
                /v(\d+\.\d+\.?\d*)/i,
                /version\s+(\d+\.\d+\.?\d*)/i,
                /release\s+(\d+\.\d+\.?\d*)/i,
                /r(\d+\.\d+\.?\d*)/i,
                /(\d+\.\d+\.?\d*)\s*release/i,
            ];
            
            for (const pattern of patterns) {
                const match = String(summary).match(pattern);
                if (match) {
                    const version = match[1] || match[0];
                    return version;
                }
            }
            return null;
        };

        const findRelease = (fields, exec, storyFields) => {
            // Priority 1: Check execution ticket's fixVersions field
            const fixVersions = (fields?.fixVersions && fields.fixVersions.length ? fields.fixVersions : null) || exec?.fixVersions || [];
            
            for (const fv of fixVersions) {
                const name = fv?.name;
                if (!name) {
                    continue;
                }
                const rel = releases.find((r) => r.releaseName === name);
                if (rel) {
                    return { releaseDoc: rel, releaseName: name };
                }
                return { releaseDoc: null, releaseName: name };
            }

            // Priority 2: Check execution ticket's summary for fixVersion pattern
            const execSummaryVersion = parseFixVersionFromSummary(exec.summary || fields.summary);
            if (execSummaryVersion) {
                const rel = releases.find((r) => 
                    r.releaseName === execSummaryVersion || 
                    r.releaseName?.includes(execSummaryVersion) ||
                    execSummaryVersion.includes(r.releaseName || '')
                );
                if (rel) {
                    return { releaseDoc: rel, releaseName: rel.releaseName };
                }
                return { releaseDoc: null, releaseName: execSummaryVersion };
            }

            // Priority 3: Check linked story's fixVersions field
            if (storyFields?.fixVersions && storyFields.fixVersions.length) {
                for (const fv of storyFields.fixVersions) {
                    const name = fv?.name;
                    if (!name) {
                        continue;
                    }
                    const rel = releases.find((r) => r.releaseName === name);
                    if (rel) {
                        return { releaseDoc: rel, releaseName: name };
                    }
                    return { releaseDoc: null, releaseName: name };
                }
            }

            // Priority 4: Check linked story's summary for fixVersion pattern
            if (storyFields?.summary) {
                const storySummaryVersion = parseFixVersionFromSummary(storyFields.summary);
                if (storySummaryVersion) {
                    const rel = releases.find((r) => 
                        r.releaseName === storySummaryVersion || 
                        r.releaseName?.includes(storySummaryVersion) ||
                        storySummaryVersion.includes(r.releaseName || '')
                    );
                    if (rel) {
                        return { releaseDoc: rel, releaseName: rel.releaseName };
                    }
                    return { releaseDoc: null, releaseName: storySummaryVersion };
                }
            }

            return { releaseDoc: null, releaseName: null };
        };

        const enrichTestsWithLinkedStories = async ({ tests, jiraHost, jiraAuthHeader }) => {
            if (!jiraHost || !jiraAuthHeader) {
                return tests || [];
            }
            const issueCache = new Map();
            const storyCache = new Map();
            const enriched = [];
            for (const t of tests || []) {
                const key = t.key || t.id || t.testKey || t.test?.key || t.test?.issueKey;
                if (!key) {
                    enriched.push(t);
                    continue;
                }
                let issue = issueCache.get(key);
                if (!issue) {
                    try {
                        issue = await this.fetchJiraIssue(jiraHost, jiraAuthHeader, key);
                        issueCache.set(key, issue);
                    } catch (err) {
                        enriched.push(t);
                        continue;
                    }
                }
                const fields = issue?.fields || {};
                const links = Array.isArray(fields.issuelinks) ? fields.issuelinks : [];
                const storyKeys = [];
                for (const link of links) {
                    const linked = link.outwardIssue || link.inwardIssue;
                    if (linked?.key) {
                        storyKeys.push(linked.key);
                    }
                }

                let storyKey = null;
                let storyFields = null;
                if (storyKeys.length) {
                    storyKey = storyKeys[0];
                    storyFields = storyCache.get(storyKey);
                    if (!storyFields) {
                        try {
                            const storyIssue = await this.fetchJiraIssue(jiraHost, jiraAuthHeader, storyKey);
                            storyFields = storyIssue?.fields || null;
                            storyCache.set(storyKey, storyFields);
                        } catch (storyErr) {
                            // Ignore story fetch error
                        }
                    }
                }

                const sprintField =
                    storyFields?.customfield_10020 ||
                    storyFields?.sprint ||
                    fields.customfield_10020 ||
                    fields.sprint;
                const parsedSprintList = parseSprintField(sprintField);
                let { sprintIdNum, sprintNameVal } = pickLatestParsedSprint(parsedSprintList);
                if (!sprintIdNum && !sprintNameVal) {
                    const fromSummary = parseSprintFromSummary(storyFields?.summary || fields.summary || t.name);
                    sprintIdNum = sprintIdNum || fromSummary.sprintIdNum;
                    sprintNameVal = sprintNameVal || fromSummary.sprintNameVal;
                }

                const releaseName =
                    (storyFields?.fixVersions && storyFields.fixVersions[0]?.name) ||
                    (fields.fixVersions && fields.fixVersions[0]?.name) ||
                    null;

                enriched.push({
                    ...t,
                    _linkedStoryKey: storyKey || t._linkedStoryKey,
                    _runSprintId: sprintIdNum ? String(sprintIdNum) : undefined,
                    _runSprintName: sprintNameVal,
                    _runReleaseName: releaseName,
                });
            }
            return enriched;
        };

        const splitRuns = (tests, thresholdDate = null) => {
            const manualRunsMap = new Map();
            const automationRunsMap = new Map();
            const allStoryKeys = new Set();
            
            for (const t of tests || []) {
                const key = t.key || t.id || t.testKey || t.test?.key || t.test?.issueKey || t.name;
                if (!key) {
                    continue;
                }

                if (t._linkedStoryKey) {
                    allStoryKeys.add(t._linkedStoryKey);
                }

                const typeRaw = t.type || t.testType || t.testTypeName || t.testType?.name || t.info?.type || t.test?.type || t.test?.testType?.name || '';
                const typeUpper = String(typeRaw).toUpperCase();
                const isAuto = typeUpper === 'ATM' || typeUpper === 'AUTOMATED' || typeUpper.includes('AUTO') || typeUpper.includes('CUCUMBER') || typeUpper.includes('ROBOT');

                const statusRaw = t.status?.name || t.status || t.runStatus || '';
                const statusLower = String(statusRaw).toLowerCase();

                const completedOnVal = t.completed_on ? new Date(t.completed_on) : t.finishedOn ? new Date(t.finishedOn) : t.completedOn ? new Date(t.completedOn) : null;
                const createdOnVal = t.created_on ? new Date(t.created_on) : t.created ? new Date(t.created) : t.test?.created ? new Date(t.test.created) : null;
                const updatedOnVal = t.updated_on ? new Date(t.updated_on) : t.updated ? new Date(t.updated) : t.test?.updated ? new Date(t.test.updated) : null;

                // Calculate counts and pass percentage
                const passedCount = t.passed_count ?? (statusLower === 'passed' ? 1 : 0);
                const failedCount = t.failed_count ?? (statusLower === 'failed' ? 1 : 0);
                const blockedCount = t.blocked_count ?? (statusLower === 'blocked' ? 1 : 0);
                const untestedCount = t.untested_count ?? (statusLower === 'to do' || statusLower === 'todo' ? 1 : 0);
                const retestCount = t.retest_count ?? 0;
                const totalCount = passedCount + failedCount + blockedCount + untestedCount + retestCount;
                const passPct = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

                const base = {
                    id: t.id || t.testKey || t.test?.id || t.key || key,
                    key,
                    name: t.name || t.summary || t.test?.summary || t.testKey || t.key || '',
                    description: t.description || t.test?.description || '',
                    status: statusRaw,
                    type: typeRaw || '',
                    is_completed: t.is_completed ?? ['passed', 'failed', 'blocked', 'done'].includes(statusLower),
                    completed_on: completedOnVal,
                    passed_count: passedCount,
                    untested_count: untestedCount,
                    blocked_count: blockedCount,
                    retest_count: retestCount,
                    failed_count: failedCount,
                    project_id: t.project_id || t.projectId || t.test?.projectId || t.test?.project_id,
                    manual_percentage: t.manual_percentage,
                    pass_percentage: passPct,
                    url: t.url,
                    created_on: createdOnVal,
                    updated_on: updatedOnVal,
                    storyKey: t._linkedStoryKey,
                    sprintId: t._runSprintId,
                    sprintName: t._runSprintName,
                    releaseName: t._runReleaseName,
                };

                const hasData =
                    base.name ||
                    base.description ||
                    base.status ||
                    base.type ||
                    base.passed_count ||
                    base.failed_count ||
                    base.blocked_count ||
                    base.untested_count ||
                    base.retest_count ||
                    base.url ||
                    base.created_on ||
                    base.updated_on;
                if (!hasData) {
                    continue;
                }

                if (isAuto) {
                    automationRunsMap.set(key, base);
                } else {
                    manualRunsMap.set(key, base);
                }
            }

            // Calculate test case metrics
            const calculateMetrics = (runsMap) => {
                const uniqueStoryKeys = new Set();
                let casesWithReferences = 0;
                let casesWithoutReferences = 0;
                let automatedCasesCount = 0;
                const testsToBeAutomatedCount = 0;
                let newlyAddedCasesCount = 0;

                for (const run of runsMap.values()) {
                    // Count references
                    if (run.storyKey) {
                        casesWithReferences++;
                        uniqueStoryKeys.add(run.storyKey);
                    } else {
                        casesWithoutReferences++;
                    }

                    // Count automation status
                    const typeUpper = String(run.type || '').toUpperCase();
                    if (typeUpper.includes('AUTO') || typeUpper === 'ATM' || typeUpper === 'AUTOMATED') {
                        automatedCasesCount++;
                    }

                    // Count newly added (created after threshold)
                    if (thresholdDate && run.created_on) {
                        const createdTime = new Date(run.created_on).getTime();
                        if (createdTime >= thresholdDate) {
                            newlyAddedCasesCount++;
                        }
                    }
                }

                return {
                    references: uniqueStoryKeys.size,
                    casesWithReferences,
                    casesWithoutReferences,
                    automatedCasesCount,
                    testsToBeAutomatedCount,
                    newlyAddedCasesCount,
                };
            };

            const manualRuns = Array.from(manualRunsMap.values());
            const automationRuns = Array.from(automationRunsMap.values());

            // Calculate metrics for the entire execution
            const allTests = [...manualRuns, ...automationRuns];
            const executionMetrics = calculateMetrics(new Map(allTests.map((t) => [t.key, t])));

            return {
                manualRuns,
                automationRuns,
                totalReferences: allStoryKeys.size,
                testCaseMetrics: executionMetrics,
            };
        };

        // Helper to aggregate story references from test runs
        const aggregateStoryReferences = (tests) => {
            const storyRefMap = new Map(); // storyKey -> { count, sprintId, sprintName, releaseName }
            
            for (const t of tests || []) {
                const storyKey = t._linkedStoryKey;
                if (!storyKey) {
                    continue;
                }
                
                if (!storyRefMap.has(storyKey)) {
                    storyRefMap.set(storyKey, {
                        storyKey,
                        count: 0,
                        sprintId: t._runSprintId,
                        sprintName: t._runSprintName,
                        releaseName: t._runReleaseName,
                    });
                }
                
                const ref = storyRefMap.get(storyKey);
                ref.count++;
                
                // Update sprint/release if this run has better data
                if (!ref.sprintId && t._runSprintId) {
                    ref.sprintId = t._runSprintId;
                }
                if (!ref.sprintName && t._runSprintName) {
                    ref.sprintName = t._runSprintName;
                }
                if (!ref.releaseName && t._runReleaseName) {
                    ref.releaseName = t._runReleaseName;
                }
            }
            
            // Return sorted by count (most referenced first)
            return Array.from(storyRefMap.values()).sort((a, b) => b.count - a.count);
        };

        const mapped = [];
        for (const exec of executions) {
            const fields = exec._jiraFields || exec.fields || {};
            const storyFields = exec._linkedStoryFields || null;
            const testsRaw = Array.isArray(exec.tests) ? exec.tests : Array.isArray(exec._tests) ? exec._tests : [];
            const tests = await enrichTestsWithLinkedStories({ tests: testsRaw, jiraHost, jiraAuthHeader });
            
            // Aggregate story references from test runs
            const storyRefs = aggregateStoryReferences(tests);
            const mostReferencedStory = storyRefs[0] || null;
            
            // Use most referenced story's sprint/release if execution doesn't have them
            let enhancedStoryFields = storyFields;
            if (mostReferencedStory && !storyFields) {
                enhancedStoryFields = {
                    customfield_10020: mostReferencedStory.sprintId,
                    sprint: mostReferencedStory.sprintName,
                    fixVersions: mostReferencedStory.releaseName ? [{ name: mostReferencedStory.releaseName }] : [],
                };
            }
            
            const testCounts = this.countTests(tests);
            const { sprintDocs } = findSprint(fields, exec, enhancedStoryFields);
            const { releaseDoc, releaseName } = findRelease(fields, exec, enhancedStoryFields);
            
            // Calculate threshold date for newly added tests (30 days before now, or sprint/release start date)
            let thresholdDate = null;
            const now = Date.now();
            const latestSprintDoc = pickLatestSprintDoc(sprintDocs);
            if (latestSprintDoc?.startDate) {
                thresholdDate = new Date(latestSprintDoc.startDate).getTime();
            } else if (releaseDoc?.startDate) {
                thresholdDate = new Date(releaseDoc.startDate).getTime();
            } else {
                thresholdDate = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
            }
            
            const { manualRuns, automationRuns, totalReferences, testCaseMetrics } = splitRuns(tests, thresholdDate);

            const startedAt = fields.created ? new Date(fields.created) : exec.startDate ? new Date(exec.startDate) : null;
            const finishedAt = fields.resolutiondate ? new Date(fields.resolutiondate) : exec.finishDate ? new Date(exec.finishDate) : null;

            // Store arrays of boardId and sprintId in single document
            const boardIds = sprintDocs && sprintDocs.length > 0 
                ? sprintDocs.map(s => s.boardId).filter(Boolean) 
                : (releaseDoc?.boardId ? [releaseDoc.boardId] : []);
            const sprintIds = sprintDocs && sprintDocs.length > 0 
                ? sprintDocs.map(s => s._id) 
                : [];
            const firstSprintName = latestSprintDoc
                ? (latestSprintDoc.name || latestSprintDoc.sprintName || null) 
                : null;

            mapped.push({
                companyId,
                jiraProjectId: jiraProject?._id || null,
                projectKey,
                testExecKey: exec.key || exec.testExecKey || exec.id || '',
                sourceType: exec._sourceType || exec.sourceType || 'execution',
                summary: fields.summary || exec.summary || '',
                status: (fields.status && fields.status.name) || exec.status || '',
                startedAt,
                finishedAt,
                boardId: boardIds,
                sprintId: sprintIds,
                sprintName: firstSprintName,
                releaseId: releaseDoc?._id || null,
                releaseName: releaseDoc?.releaseName || releaseName || null,
                testsCount: testCounts.total,
                testsPassed: testCounts.passed,
                testsFailed: testCounts.failed,
                testsBlocked: testCounts.blocked,
                testsOther: testCounts.other,
                manualTests: testCounts.manual,
                automationTests: testCounts.automation,
                manualRuns,
                automationRuns,
                totalReferences: totalReferences || 0,
                testCaseMetrics: testCaseMetrics || {
                    references: 0,
                    casesWithReferences: 0,
                    casesWithoutReferences: 0,
                    automatedCasesCount: 0,
                    testsToBeAutomatedCount: 0,
                    newlyAddedCasesCount: 0,
                },
            });
        }
        return mapped;
    }

    countTests(tests) {
        let total = 0,
            passed = 0,
            failed = 0,
            blocked = 0,
            other = 0,
            manual = 0,
            automation = 0;
        for (const t of tests) {
            total++;
            const status = (t.status?.name || t.status || '').toLowerCase();
            if (status === 'passed') {
                passed++;
            } else if (status === 'failed') {
                failed++;
            } else if (status === 'blocked') {
                blocked++;
            } else {
                other++;
            }

            const typeRaw = t.type || t.testType || t.testTypeName || t.info?.type || t.test?.type || '';
            const typeUpper = String(typeRaw).toUpperCase();
            const isAuto = typeUpper === 'ATM' || typeUpper === 'AUTOMATED' || typeUpper.includes('AUTO') || typeUpper.includes('CUCUMBER') || typeUpper.includes('ROBOT');
            if (isAuto) {
                automation++;
            } else {
                manual++;
            }
        }
        return { total, passed, failed, blocked, other, manual, automation };
    }
}

export default new XrayService();
