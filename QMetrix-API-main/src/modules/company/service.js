import TestManagementService from '../test-management/common/service';
import ProjectManagementService from '../project-management/common/service';
import SourceCodeManagementService from '../source-code-management/common/service';
import { ProjectModel } from '../project-management/jira/model.js';
import connectionManager from '../../config/connectionManager.js';
import { duplicatedFilesScore, vulnerabilitiesScore, securityHotspotsScore, duplicatedBlocksScore, duplicatedLinesScore, codeSmellsScore } from '../../utils/staticCodeAnalysisCal.js';
import CxoService from '../cxo/services/cxoService.js';
import { ConnectionModel } from '../connection/model.js';
import { CompanyModel } from './model.js';
import { exec } from 'child_process';
import 'dotenv/config';
import axios from 'axios';
import path from 'path';
import cron from 'node-cron';
import tmp from 'tmp';
import { cryptoHandler } from '../../utils/commonFunctions.js';
import { redis } from '../../server.js';
import techQualityController from '../tech-Quality/controllers/techQualityController.js';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_GITLAB_ISSUES,
    PROVIDER_NAME_GITHUB,
    PROVIDER_NAME_GITLAB,
    PROVIDER_NAME_ADO,
    PROVIDER_NAME_BITBUCKET,
} from '../../utils/constants/providerConstants.js';

class CompanyService {
    async syncCompanyData(companyId, tenantConnection, failedOnly = false, syncCurrent = false, projectId = null) {
        await redis.flushall();
        const Project = ProjectModel(tenantConnection);
        const Connection = ConnectionModel(tenantConnection);
        const jiraCred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_GITLAB_ISSUES] } });
        const gitCred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_GITHUB, PROVIDER_NAME_GITLAB, PROVIDER_NAME_ADO, PROVIDER_NAME_BITBUCKET] } });
        const testCred = await Connection.findOne({ companyId, name: { $in: ['Testrail', 'Xray Cloud'] } });
        let projects;

        if (syncCurrent && projectId) {
            const project = await Project.findOne({
                companyId,
                _id: projectId,
                isSelected: true,
            });

            if (!project) {
                return {
                    success: false,
                    message: 'Project not found or not selected for sync',
                    projectCount: 0,
                };
            }

            projects = [project];
        } else if (failedOnly) {
            projects = await Project.find({
                companyId,
                isSelected: true,
                syncStatus: false,
            });
        } else {
            projects = await Project.find({ companyId, isSelected: true });
        }

        if (!projects || projects.length === 0) {
            const message = syncCurrent ? 'Project not found or not selected for sync' : failedOnly ? 'No failed projects found for sync' : 'No projects found for sync';
            return {
                success: false,
                message,
                projectCount: 0,
            };
        }
        const allResponses = [];
        let allProjectsSuccess = true;
        for (const project of projects) {
            const projectId = project._id.toString();

            const response = {
                projectManagement: null,
                sourceCodeManagement: null,
                testManagement: null,
                cxo: null,
                techQuality: null,
            };
            const changeTypeForProjectManagement = project.hardSyncStatus.projectManagement ? 'light' : 'hard';
            const changeTypeForSourceCodeManagement = project.hardSyncStatus.sourceCodeManagement ? 'light' : 'hard';
            const changeTypeForTestManagement = project.hardSyncStatus.testManagement ? 'light' : 'hard';
            const changeTypeForCXO = project.hardSyncStatus.cxo ? 'light' : 'hard';
            const changeTypeForTechQuality = project.hardSyncStatus.techQuality ? 'light' : 'hard';
            let allSuccess = true;
            const hardSyncCompleted = {
                projectManagement: project.hardSyncStatus.projectManagement || false,
                sourceCodeManagement: project.hardSyncStatus.sourceCodeManagement || false,
                testManagement: project.hardSyncStatus.testManagement || false,
                cxo: project.hardSyncStatus.cxo || false,
                techQuality: project.hardSyncStatus.techQuality || false,
            };

            try {
                await ProjectManagementService.syncProjectManagementData(companyId, tenantConnection, changeTypeForProjectManagement, projectId);
                response.projectManagement = { status: 'success' };
                if (jiraCred && changeTypeForProjectManagement === 'hard') {
                    hardSyncCompleted.projectManagement = true;
                }
            } catch (error) {
                console.error(`ProjectManagement (${project.name}): ${error.message}`);
                response.projectManagement = { status: 'error', message: error.message };
                allSuccess = false;
            }

            try {
                await SourceCodeManagementService.syncSourceCodeManagementData(companyId, tenantConnection, changeTypeForSourceCodeManagement, projectId);
                response.sourceCodeManagement = { status: 'success' };
                if (gitCred && changeTypeForSourceCodeManagement === 'hard') {
                    hardSyncCompleted.sourceCodeManagement = true;
                }
            } catch (error) {
                console.error(`SourceCodeManagement (${project.name}): ${error.message}`);
                response.sourceCodeManagement = { status: 'error', message: error.message };
                allSuccess = false;
            }

            try {
                await TestManagementService.syncTestManagementData(companyId, tenantConnection, projectId, changeTypeForTestManagement);
                response.testManagement = { status: 'success' };
                if (testCred && changeTypeForTestManagement === 'hard') {
                    hardSyncCompleted.testManagement = true;
                }
            } catch (error) {
                console.error(`TestManagement (${project.name}): ${error.message}`);
                response.testManagement = { status: 'error', message: error.message };
                allSuccess = false;
            }

            if (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'dev') {
                await this.sonarQubeScan(companyId, tenantConnection, project._id);
            }

            try {
                await CxoService.createCXO(companyId, tenantConnection, changeTypeForCXO, projectId);
                response.cxo = { status: 'success' };
                if (jiraCred && changeTypeForCXO === 'hard') {
                    hardSyncCompleted.cxo = true;
                }
            } catch (error) {
                console.error(`CXO (${project.name}): ${error.message}`);
                response.cxo = { status: 'error', message: error.message };
                allSuccess = false;
            }

            try {
                await techQualityController.createTechQualityRecord(companyId, tenantConnection, changeTypeForTechQuality, projectId);
                response.techQuality = { status: 'success' };
                if (jiraCred && changeTypeForTechQuality === 'hard') {
                    hardSyncCompleted.techQuality = true;
                }
            } catch (error) {
                console.error(`TechQuality (${project.name}): ${error.message}`);
                response.techQuality = { status: 'error', message: error.message };
                allSuccess = false;
            }

            if (allSuccess) {
                const updateData = {
                    syncStatus: true,
                    lastSynced: this.getCurrentDateTime(projectId).currentDateTime,
                    updatedAt: new Date(),
                    hardSyncStatus: hardSyncCompleted,
                };

                await Project.updateOne({ _id: project._id }, { $set: updateData });
            } else {
                await Project.updateOne(
                    { _id: project._id },
                    {
                        $set: {
                            syncStatus: false,
                            hardSyncStatus: hardSyncCompleted,
                            updatedAt: new Date(),
                        },
                    }
                );
                allProjectsSuccess = false;
            }
            allResponses.push(response);
        }
        try {
            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const companyUpdateData = {
                syncStatus: allProjectsSuccess,
                updatedAt: new Date(),
            };
            await MetaCompany.findOneAndUpdate({ _id: companyId }, { $set: companyUpdateData });
            const Project = ProjectModel(tenantConnection);
            const currentDateTime = this.getCurrentDateTime(companyId).currentDateTime;

            for (let i = 0; i < projects.length; i++) {
                const project = projects[i];
                const response = allResponses[i];
                if (syncCurrent && projectId) {
                    if (project._id.toString() === projectId) {
                        await Project.findOneAndUpdate({ _id: project._id }, { $set: { lastSynced: currentDateTime, updatedAt: new Date() } });
                    }
                } else if (failedOnly) {
                    if (!response.success) {
                        await Project.findOneAndUpdate({ _id: project._id }, { $set: { lastSynced: currentDateTime, updatedAt: new Date() } });
                    }
                } else {
                    await Project.findOneAndUpdate({ _id: project._id }, { $set: { lastSynced: currentDateTime, updatedAt: new Date() } });
                }
            }
        } catch (error) {
            console.error('Error updating sync status:', error);
        }
        return allResponses;
    }

    getCurrentDateTime(selectedId) {
        try {
            const now = new Date();
            const currentDateTime = now.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            });
            return { currentDateTime, selectedId };
        } catch (error) {
            console.error(error);
        }
    }

    execPromise(command, options = {}) {
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error(stderr || error.message));
                }
                resolve(stdout);
            });
        });
    }

    async analyzeRepository(repoUrl, cred) {
        const tmpDir = tmp.dirSync({ unsafeCleanup: true });

        try {
            const host = cred.host;
            const token = cryptoHandler(cred.password, 'decrypt');

            if (!host || !token) {
                throw new Error('GitHub host or token is missing in environment variables.');
            }

            const url = new URL(repoUrl);
            url.username = host;
            url.password = token;
            const authenticatedRepoUrl = url.toString();
            const repoName = path.basename(repoUrl, '.git');
            const projectName = `QM_${repoName}`;
            const cloneDir = path.join(tmpDir.name, repoName);
            await this.execPromise(`git clone ${authenticatedRepoUrl} ${cloneDir}`);

            if (process.env.NODE_ENV === 'local') {
                process.chdir('C:/');
            }

            const sonarCommand = `"${process.env.SONAR_SCANNER_PATH}" -Dsonar.projectKey=${projectName} -Dsonar.projectName=${projectName} -Dsonar.sources="${path
                .join(cloneDir, 'src')
                .replace(/\\/g, '/')}" -Dsonar.host.url=${process.env.SONAR_HOST_URL_DEV} -Dsonar.login=${process.env.SONAR_TOKEN_DEV}`;

            await this.execPromise(sonarCommand);
        } catch (error) {
            console.error(`Error processing repository ${repoUrl}:`, error.message);
        } finally {
            tmpDir.removeCallback();
        }
    }

    async sonarQubeScan(companyId, tenantConnection, projectId) {
        const Project = ProjectModel(tenantConnection);
        const Connection = ConnectionModel(tenantConnection);
        const cred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });
        const retry = async (fn, retries = 3, delay = 1000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    return await fn();
                } catch (error) {
                    console.error(`Attempt ${i + 1} failed: ${error.message}`);
                    if (i < retries - 1) {
                        await new Promise((res) => setTimeout(res, delay));
                    } else {
                        throw error;
                    }
                }
            }
        };

        try {
            const project = await Project.findOne({ companyId, _id: projectId });

            const { repos } = project;
            for (const repo of repos) {
                try {
                    await retry(() => this.analyzeRepository(repo, cred), 3, 2000);
                } catch (error) {
                    console.error(`Error analyzing repository ${repo} after retries:`, error.message);
                }
                try {
                    await this.fetchScanResult(repo, projectId, tenantConnection);
                } catch (error) {
                    console.error(`Error analyzing repository ${repo} after retries:`, error.message);
                }
                await this.fetchSonarQubeData(companyId, projectId, tenantConnection);
            }
        } catch (error) {
            console.error('Error fetching projects:', error.message);
        }
    }

    async fetchScanResult(repo, projectId, tenantConnection) {
        try {
            const repoName = path.basename(repo, '.git');
            const PROJECT_KEY = `QM_${repoName}`;
            const response = await axios.get(`${process.env.SONAR_HOST_URL_DEV}/api/measures/component`, {
                params: {
                    component: PROJECT_KEY,
                    metricKeys: 'duplicated_files,ncloc,vulnerabilities,security_hotspots,duplicated_blocks,duplicated_lines,code_smells',
                },
                headers: {
                    Authorization: `Basic ${Buffer.from(`${process.env.SONAR_TOKEN_DEV}:`).toString('base64')}`,
                },
            });

            const measures = response.data.component.measures;
            const metrics = measures.reduce((acc, measure) => {
                acc[measure.metric] = parseInt(measure.value, 10);
                return acc;
            }, {});

            const staticCodeAnalysisScore = this.staticCodeAnalysisScoreCal(metrics);
            metrics['staticCodeAnalysisScore'] = staticCodeAnalysisScore;
            metrics['repo'] = repo;
            const Project = ProjectModel(tenantConnection);

            const result = await Project.updateOne(
                {
                    _id: projectId, // Match the project by its ID
                    'sonarQubeScanReport.repo': repo, // Match an object in the array with the given repo
                },
                {
                    $set: {
                        'sonarQubeScanReport.$.staticCodeAnalysisScore': parseInt(metrics.staticCodeAnalysisScore, 10),
                        'sonarQubeScanReport.$.duplicated_files': parseInt(metrics.duplicated_files, 10),
                        'sonarQubeScanReport.$.ncloc': parseInt(metrics.ncloc, 10),
                        'sonarQubeScanReport.$.vulnerabilities': parseInt(metrics.vulnerabilities, 10),
                        'sonarQubeScanReport.$.security_hotspots': parseInt(metrics.security_hotspots, 10),
                        'sonarQubeScanReport.$.duplicated_blocks': parseInt(metrics.duplicated_blocks, 10),
                        'sonarQubeScanReport.$.duplicated_lines': parseInt(metrics.duplicated_lines, 10),
                        'sonarQubeScanReport.$.code_smells': parseInt(metrics.code_smells, 10),
                    },
                }
            );

            if (result.matchedCount === 0) {
                await Project.updateOne(
                    { _id: projectId },
                    {
                        $push: {
                            sonarQubeScanReport: {
                                repo,
                                staticCodeAnalysisScore: parseInt(metrics.staticCodeAnalysisScore, 10),
                                duplicated_files: parseInt(metrics.duplicated_files, 10),
                                ncloc: parseInt(metrics.ncloc, 10),
                                vulnerabilities: parseInt(metrics.vulnerabilities, 10),
                                security_hotspots: parseInt(metrics.security_hotspots, 10),
                                duplicated_blocks: parseInt(metrics.duplicated_blocks, 10),
                                duplicated_lines: parseInt(metrics.duplicated_lines, 10),
                                code_smells: parseInt(metrics.code_smells, 10),
                            },
                        },
                    }
                );
            }
        } catch (error) {
            console.error('Error fetching metrics:', error.response ? error.response.data : error.message);
        }
    }

    calStaticCodeAnalysisScore(aggregatedResult) {
        try {
            const { duplicated_files, vulnerabilities, security_hotspots, duplicated_blocks, duplicated_lines, code_smells } = aggregatedResult;
            const duplicatedFilesscore = duplicatedFilesScore(duplicated_files);
            const vulnerabilitiesscore = vulnerabilitiesScore(vulnerabilities);
            const securityHotspotsscore = securityHotspotsScore(security_hotspots);
            const duplicatedBlocksscore = duplicatedBlocksScore(duplicated_blocks);
            const duplicatedLinesscore = duplicatedLinesScore(duplicated_lines);
            const codeSmellsscore = codeSmellsScore(code_smells);

            const StaticCodeAnalysisScore = ((duplicatedFilesscore + vulnerabilitiesscore + securityHotspotsscore + duplicatedBlocksscore + duplicatedLinesscore + codeSmellsscore) / 6).toFixed(2);
            return StaticCodeAnalysisScore;
        } catch (error) {
            console.error('Error calculating StaticCodeAnalysis Score:', error.message);
            throw error;
        }
    }

    staticCodeAnalysisScoreCal(aggregatedResult) {
        try {
            const { duplicated_files, vulnerabilities, security_hotspots, duplicated_blocks, duplicated_lines, code_smells } = aggregatedResult;
            const duplicatedFilesscore = duplicatedFilesScore(duplicated_files);
            const vulnerabilitiesscore = vulnerabilitiesScore(vulnerabilities);
            const securityHotspotsscore = securityHotspotsScore(security_hotspots);
            const duplicatedBlocksscore = duplicatedBlocksScore(duplicated_blocks);
            const duplicatedLinesscore = duplicatedLinesScore(duplicated_lines);
            const codeSmellsscore = codeSmellsScore(code_smells);

            const StaticCodeAnalysisScore = ((duplicatedFilesscore + vulnerabilitiesscore + securityHotspotsscore + duplicatedBlocksscore + duplicatedLinesscore + codeSmellsscore) / 6).toFixed(2);
            return StaticCodeAnalysisScore;
        } catch (error) {
            console.error('Error calculating StaticCodeAnalysis Score:', error.message);
            throw error;
        }
    }

    async fetchSonarQubeData(companyId, projectId, connection) {
        try {
            const Project = ProjectModel(connection);
            const data = await Project.findOne({ companyId, _id: projectId }, { _id: 0, sonarQubeScanReport: 1 });
            const sonarQubeScanReport = data?.sonarQubeScanReport;
            const aggregatedResult = sonarQubeScanReport.reduce(
                (acc, report) => {
                    acc.duplicated_files += report.duplicated_files;
                    acc.ncloc += report.ncloc;
                    acc.vulnerabilities += report.vulnerabilities;
                    acc.security_hotspots += report.security_hotspots;
                    acc.duplicated_blocks += report.duplicated_blocks;
                    acc.duplicated_lines += report.duplicated_lines;
                    acc.code_smells += report.code_smells;
                    return acc;
                },
                {
                    duplicated_files: 0,
                    ncloc: 0,
                    vulnerabilities: 0,
                    security_hotspots: 0,
                    duplicated_blocks: 0,
                    duplicated_lines: 0,
                    code_smells: 0,
                }
            );
            const staticCodeAnalysisScore = this.calStaticCodeAnalysisScore(aggregatedResult);
            aggregatedResult.staticCodeAnalysisScore = staticCodeAnalysisScore;
            const res = await Project.updateOne({ companyId, _id: projectId }, { combinedScanData: aggregatedResult }, { upsert: true });
            return { staticCodeAnalysisScore, res };
        } catch (error) {
            console.error('Error fetching releases data:', error.message);
            throw error;
        }
    }

    async cronJob() {
        try {
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('Cron jobs will not run in non-production environments.');
                return;
            }
            const metaConnection = connectionManager.connectToMetaDB();
            const Company = CompanyModel(metaConnection);
            const companies = await Company.find();

            companies.forEach((company, index) => {
                const companyId = company._id;
                const companyName = company.companyName;
                const databaseUri = company.databaseUri;
                const tenantConnection = connectionManager.getTenantConnection(companyName, databaseUri);

                // const baseHour = 3;
                // const baseMinute = 15; // UTC (03:15 UTC = 08:45 IST)
                // const intervalMinutes = 10;

                // const totalMinutes = baseMinute + index * intervalMinutes;
                // const cronMinute = totalMinutes % 60;
                // const cronHour = baseHour + Math.floor(totalMinutes / 60);

                const baseHourEvening = 14;
                const intervalMinutesEvening = 10;
                const cronMinuteEvening = (index * intervalMinutesEvening) % 60;
                const cronHourEvening = baseHourEvening + Math.floor((index * intervalMinutesEvening) / 60);

                // const morningCronExpression = `${cronMinute} ${cronHour} * * *`;
                // this.scheduleSyncCompanyData(companyId, tenantConnection, morningCronExpression);

                // eslint-disable-next-line quotes
                const eveningCronExpression = `${cronMinuteEvening} ${cronHourEvening} * * *`;
                this.scheduleSyncCompanyData(companyId, tenantConnection, eveningCronExpression);
            });
        } catch (error) {
            console.error('Error fetching companies or scheduling jobs:', error);
        }
    }

    scheduleSyncCompanyData(companyId, tenantConnection, cronExpression) {
        // eslint-disable-next-line no-console
        console.log(`Scheduling cron job for companyId: ${companyId} with cron expression: ${cronExpression}`);

        cron.schedule(cronExpression, async () => {
            // eslint-disable-next-line no-console
            console.log(`Cron job triggered for companyId: ${companyId}}`);
            await this.syncCompanyData(companyId, tenantConnection);
        });
    }
}

export default new CompanyService();
