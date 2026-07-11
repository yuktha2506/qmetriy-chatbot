import { Types } from 'mongoose';
import { JiraReleaseModel } from '../../project-management/jira/model.js';
import { CompanyModel } from '../../company/model.js';
import connectionManager from '../../../config/connectionManager.js';
import { issue_Type_Budget_Percentage } from '../../../utils/constants/custumFieldConstants.js';
import { STATUS_ACTIVE } from '../../../utils/constants/statusConstants.js';

const isNil = (value) => value === null || value === undefined;

class ReleaseDashboardService {
    async getReleaseDashboardData(companyId, projectId, boardId, releaseId, connection) {
        try {
            const JiraRelease = JiraReleaseModel(connection);

            const release = await JiraRelease.findOne(
                {
                    _id: new Types.ObjectId(releaseId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    boardId: new Types.ObjectId(boardId),
                },
                {
                    _id: 1,
                    companyId: 1,
                    projectId: 1,
                    boardId: 1,
                    releaseName: 1,
                    releaseDate: 1,
                    releaseBurndownData: 1,
                    releaseBurnup: 1,
                    riskAndAlerts: 1,
                    accuracyMetrics: 1,
                    investmentProfile: 1,
                    hours: 1,
                    assignees: 1,
                    investmentProfileTicketCounts: 1,
                    committedVsCompletedMetrics: 1,
                }
            ).lean();
            if (!release) {
                return null;
            }

            const metaConn = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConn);
            const companyDoc = await MetaCompany.findOne(
                { _id: new Types.ObjectId(companyId) },
                { storyPoints: 1 }
            ).lean();
            const companyStoryPoints = companyDoc?.storyPoints ?? 8;

            const burnupData = release.releaseBurnup;
            const burndownData = release.releaseBurndownData;
            const velocityDropResult = burnupData?.sprintBreakdown
                ? this.getVelocityDropFromBurnup(burnupData.sprintBreakdown)
                : {};

            const allocatedBudget = this.computeAllocatedBudgetFromAssignees(
                release.assignees,
                release.hours,
                companyStoryPoints
            );
            const budgetCostAnalysis = this.buildBudgetCostAnalysis(release.investmentProfile, allocatedBudget);

            return {
                releaseId: release._id,
                companyId: release.companyId,
                projectId: release.projectId,
                boardId: release.boardId,
                releaseName: release.releaseName,
                targetedReleaseDate: release.releaseDate ? new Date(release.releaseDate).toISOString().split('T')[0] : null,
                remainingSprints: burndownData?.workForecast?.sprintsRemaining || 0,
                averageVelocity: burndownData?.workForecast?.averageVelocity || 0,
                forecastedDate: burndownData?.forecastedDate
                    ? new Date(burndownData.forecastedDate).toISOString().split('T')[0]
                    : null,
                burnup: burnupData
                    ? { sprintBreakdown: burnupData.sprintBreakdown || [] }
                    : null,
                burndown: burndownData
                    ? {
                        originalEstimateAtStart: burndownData.originalEstimateAtStart,
                        completed: burndownData.completed,
                        sprintBreakdown: burndownData.sprintBreakdown || [],
                        workForecast: {
                            remainingWork: burndownData.workForecast?.remainingWork,
                        },
                    }
                    : null,
                riskAndAlert: {
                    openIssueCount: release.riskAndAlerts?.openIssueCount ?? 0,
                    openIssues: release.riskAndAlerts?.openIssues ?? [],
                    criticalCount: release.riskAndAlerts?.criticalCount ?? 0,
                    criticalIssues: release.riskAndAlerts?.criticalIssues ?? [],
                    blockerDetected: release.riskAndAlerts?.blockerDetected ?? 0,
                    blockerIssues: release.riskAndAlerts?.blockerIssues ?? [],
                    scopeUpdate: release.riskAndAlerts?.scopeUpdate ?? 0,
                    ...(velocityDropResult.insufficientVelocity !== undefined && { insufficientVelocityDrop: velocityDropResult.insufficientVelocity }),
                    ...(velocityDropResult.velocityDrop !== undefined && { velocityDrop: velocityDropResult.velocityDrop }),
                },
                accuracyScoreDetails: this.buildAccuracyScoreDetails(release.accuracyMetrics),
                investmentProfile: this.formatInvestmentProfile(
                    release.investmentProfile,
                    release.assignees,
                    release.investmentProfileTicketCounts,
                    companyStoryPoints
                ),
                budgetCostAnalysis,
            };
        } catch (error) {
            console.error('Error fetching release dashboard data:', error.message);
            throw error;
        }
    }

    buildAccuracyScoreDetails(accuracyMetrics) {
        if (!accuracyMetrics || accuracyMetrics.insufficientSprints === true) {
            return { insufficientSprint: true };
        }
        const mapLatestTotal = (obj) => {
            if (!obj) {
                return null;
            }
            const latestVal = obj.latest !== null && obj.latest !== undefined ? obj.latest : null;
            const totalVal = obj.total !== null && obj.total !== undefined ? obj.total : null;
            if (latestVal === null && totalVal === null) {
                return null;
            }
            return {
                latest: latestVal,
                total: totalVal,
            };
        };
        const accuracyScore = mapLatestTotal(accuracyMetrics.accuracyScore);
        const planningAccuracy = mapLatestTotal(accuracyMetrics.planningAccuracy);
        const capacityAccuracy = mapLatestTotal(accuracyMetrics.capacityAccuracy);
        const sprints = (accuracyMetrics.accuracySprints || []).map((s) => ({
            sprint: s.sprint ?? null,
            planningAccuracy: s.planningAccuracy !== null && s.planningAccuracy !== undefined ? s.planningAccuracy : null,
            capacityAccuracy: s.capacityAccuracy !== null && s.capacityAccuracy !== undefined ? s.capacityAccuracy : null,
        }));
        return {
            accuracyScore: accuracyScore ?? null,
            planningAccuracy: planningAccuracy ?? null,
            capacityAccuracy: capacityAccuracy ?? null,
            sprints,
        };
    }

    computeAllocatedBudgetFromAssignees(assignees, isHoursBased, companyStoryPoints = 8) {
        if (!Array.isArray(assignees) || assignees.length === 0) {
            return 0;
        }
        const storyPointsToHours = companyStoryPoints ?? 8;

        const total = assignees.reduce((sum, a) => {
            const netCapacity = Number(a?.netAvailableCapacity) || 0;
            const billingRate = Number(a?.billingRate) || 0;
            const hours = isHoursBased ? netCapacity : netCapacity * storyPointsToHours;
            const cost = hours * billingRate;
            return sum + cost;
        }, 0);

        return parseFloat(total.toFixed(2));
    }

    getCommittedTicketCostByIssueType(issueType, allocatedBudget) {
        const budget = Number(allocatedBudget);
        if (isNil(issueType) || !Number.isFinite(budget) || budget <= 0) {
            return 0;
        }
        const key = String(issueType).trim().toLowerCase();
        const percentage = issue_Type_Budget_Percentage[key];
        if (isNil(percentage) || percentage <= 0) {
            return 0;
        }
        const value = (budget * percentage) / 100;
        return Number(value.toFixed(2));
    }

    buildBudgetCostAnalysis(investmentProfile, allocatedBudget) {
        const profile = investmentProfile || {};
        const actualSpend = profile.totalCompletedCost ?? 0;
        const variance = parseFloat((allocatedBudget - actualSpend).toFixed(2));
        let status = 'on budget';
        if (actualSpend > allocatedBudget) {
            status = 'over budget';
        } else if (actualSpend < allocatedBudget) {
            status = 'under budget';
        }
        const analysisData = (profile.issueTypeBreakdown || []).map((item) => {
            const issueType = item.issueType || 'Unknown';
            const committedTicketCost = this.getCommittedTicketCostByIssueType(issueType, allocatedBudget);
            const fallbackCost = item.totalCommittedTicketCost ?? 0;
            const finalCommittedCost = committedTicketCost > 0 ? committedTicketCost : fallbackCost;
            const completedTicketCost = Math.round(Number(item.totalCompletedCost ?? 0));
            const overBudget = completedTicketCost > finalCommittedCost
                ? parseFloat((completedTicketCost - finalCommittedCost).toFixed(2))
                : 0;
            return {
                issueType,
                committedTicketCost: finalCommittedCost,
                completedTicketCost,
                overBudget,
            };
        });

        return {
            allocatedBudget,
            actualSpend,
            variance,
            status,
            analysisData,
        };
    }

    formatInvestmentProfile(investmentProfile, assignees = [], investmentProfileTicketCounts, companyStoryPoints = 8) {
        const profile = investmentProfile || {};
        const ticketCounts = investmentProfileTicketCounts || {};
        const totalCompletedHours = profile.totalCompletedHours || 0;
        const assigneesCount = Array.isArray(assignees) ? assignees.length : 0;
        const storyPoints = companyStoryPoints || 8;
        const denominator = assigneesCount * storyPoints;
        const fteEquivalent = denominator > 0
            ? parseFloat((totalCompletedHours / denominator).toFixed(2))
            : 0;

        return {
            totalCompletedStoryPoints: profile.totalCompletedStoryPoints || 0,
            totalCompletedHours,
            totalCompletedCost: profile.totalCompletedCost || 0,
            totalCommittedTicketCost: profile.totalCommittedTicketCost || 0,
            plannedTickets: ticketCounts.plannedTickets ?? 0,
            unplannedTickets: ticketCounts.unplannedTickets ?? 0,
            completedTickets: ticketCounts.completedTickets ?? 0,
            spilloverTickets: ticketCounts.spilloverTickets ?? 0,
            totalContributors: assigneesCount,
            fteEquivalent,
            issueTypeBreakdown: (profile.issueTypeBreakdown || []).map(item => ({
                issueType: item.issueType,
                committedTicketCount: item.committedTicketCount,
                completedTicketCount: item.completedTicketCount,
                completionPercentage: item.completionPercentage,
                completedPoints: item.completedPoints,
                completedHours: item.completedHours,
                totalCompletedCost: item.totalCompletedCost,
                totalCommittedTicketCost: item.totalCommittedTicketCost,
            })),
            sprintBreakdown: (profile.sprintBreakdown || []).map(sprint => ({
                sprintName: sprint.sprintName,
                totalCompletedStoryPoints: sprint.totalCompletedStoryPoints || 0,
                totalCompletedHours: sprint.totalCompletedHours || 0,
                issueTypeBreakdown: (sprint.issueTypeBreakdown || []).map(item => ({
                    issueType: item.issueType,
                    completedPoints: item.completedPoints,
                    completedHours: item.completedHours,
                })),
            })),
        };
    }

    getVelocityDropFromBurnup(sprintBreakdown) {
        if (!Array.isArray(sprintBreakdown) || sprintBreakdown.length === 0) {
            return { insufficientVelocity: true };
        }
        const comparable = sprintBreakdown.filter((s) => s && s.startDate !== null && typeof s.completedPoints === 'number');
        if (comparable.length === 0) {
            return { insufficientVelocity: true };
        }
        const sorted = [...comparable].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        const activeIndex = sorted.findIndex((s) => (s.state || '').toLowerCase() === STATUS_ACTIVE);
        if (activeIndex === -1) {
            return { insufficientVelocity: true };
        }
        const activeSprint = sorted[activeIndex];
        const previousSprints = sorted.slice(Math.max(0, activeIndex - 3), activeIndex);

        if (previousSprints.length < 3) {
            return { insufficientVelocity: true };
        }

        const sumPrev = previousSprints.reduce((acc, s) => acc + s.completedPoints, 0);
        const averageVelocityPrevious = sumPrev / 3;
        if (averageVelocityPrevious === 0) {
            return { velocityDrop: 0 };
        }
        const velocitydrop = averageVelocityPrevious - activeSprint.completedPoints;
        const veloctiyDropPercentage = (velocitydrop / averageVelocityPrevious) * 100;
        return {
            velocityDrop: Math.round(veloctiyDropPercentage),
        };
    }
}

export default new ReleaseDashboardService();
