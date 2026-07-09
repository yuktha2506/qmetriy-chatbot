import { Types } from 'mongoose';
import { SprintModel, BoardModel } from '../model';
import { redis } from '../../../../server';
import cache from '../../../../utils/cache';

function burnupStoredToApiResponse(dailyData, dateDetails, developer) {
    if (!Array.isArray(dailyData) || dailyData.length === 0) {
        return [];
    }

    const useDev = typeof developer === 'string' && developer.trim() !== '';
    const devSeriesByDate = {};
    if (useDev) {
        let prevCumulativeSP = 0;
        let prevCumulativeHrs = 0;
        let prevIdealSP = 0;
        let prevIdealHrs = 0;
        for (const d of dailyData) {
            const devEntry = Array.isArray(d.developerData) ? d.developerData.find((dev) => (dev.developer || '').toLowerCase() === developer.toLowerCase()) : null;
            if (devEntry) {
                prevCumulativeSP = devEntry.completedWorkCumulativeSP ?? prevCumulativeSP;
                prevCumulativeHrs = devEntry.completedWorkCumulativeHrs !== null ? Number(devEntry.completedWorkCumulativeHrs) : prevCumulativeHrs;
                prevIdealSP = devEntry.idealLineSP ?? prevIdealSP;
                prevIdealHrs = devEntry.idealLineHrs ?? prevIdealHrs;
            }
            devSeriesByDate[d.date] = {
                idealLineSP: prevIdealSP,
                idealLineHrs: prevIdealHrs,
                completedWorkCumulativeSP: prevCumulativeSP,
                completedWorkCumulativeHrs: prevCumulativeHrs,
            };
        }
    }

    const response = dailyData.map((d) => {
        const devEntry = useDev && Array.isArray(d.developerData) ? d.developerData.find((dev) => (dev.developer || '').toLowerCase() === developer.toLowerCase()) : null;
        const devSeries = useDev ? devSeriesByDate[d.date] : null;
        const src = useDev ? devEntry || {} : d;
        return {
            issueCreatedAt: d.date,
            storyPointsAddedNewTickets: src.storyPointsAddedNewTickets ?? 0,
            hoursAddedNewTickets: src.hoursAddedNewTickets ?? 0,
            estimationIncreasedSP: src.estimationIncreasedSP ?? 0,
            estimationIncreasedHrs: src.estimationIncreasedHrs ?? 0,
            estimationDecreasedSP: src.estimationDecreasedSP ?? 0,
            estimationDecreasedHrs: src.estimationDecreasedHrs ?? 0,
            storyPointsRemovedFromSprint: src.storyPointsRemovedFromSprint ?? 0,
            hoursRemovedFromSprint: src.hoursRemovedFromSprint ?? 0,
            storyPointsReaddedToSprint: src.storyPointsReaddedToSprint ?? 0,
            hoursReaddedToSprint: src.hoursReaddedToSprint ?? 0,
            storyPointsReopened: src.storyPointsReopened ?? 0,
            hoursReopened: src.hoursReopened ?? 0,
            storyPointsDone: src.storyPointsDone ?? 0,
            hoursDone: src.hoursDone ?? 0,
            storyPointsDoneFromInitialScope: d.storyPointsDoneFromInitialScope ?? 0,
            hoursDoneFromInitialScope: d.hoursDoneFromInitialScope ?? 0,
            storyPointsDoneFromAddedScope: d.storyPointsDoneFromAddedScope ?? 0,
            hoursDoneFromAddedScope: d.hoursDoneFromAddedScope ?? 0,
            idealLineSP: devSeries ? devSeries.idealLineSP : (d.idealLineSP ?? 0),
            idealLineHrs: devSeries ? devSeries.idealLineHrs : (d.idealLineHrs ?? 0),
            completedWorkCumulativeSP: devSeries ? devSeries.completedWorkCumulativeSP : (d.completedWorkCumulativeSP ?? 0),
            completedWorkCumulativeHrs: devSeries ? devSeries.completedWorkCumulativeHrs : (d.completedWorkCumulativeHrs ?? 0),
            completedWorkCumulativeSPWithEpic: devSeries ? devSeries.completedWorkCumulativeSP : (d.completedWorkCumulativeSP ?? 0),
            completedWorkCumulativeHrsWithEpic: devSeries ? devSeries.completedWorkCumulativeHrs : (d.completedWorkCumulativeHrs ?? 0),
            startDateEndDate: dateDetails,
        };
    });

    return response;
}

class BurnupChartController {
    async getDailyBurnup(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprints = SprintModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, developer: dev } = req.query;
            const developer = dev;

            if (!sprintId) {
                return res.status(400).json({ error: 'Burnup is supported only for sprint. sprintId is required.' });
            }

            const cacheKey = cache.generateKey('burnupChart', {
                projectId,
                companyId,
                sprintId,
                developer,
                boardId,
                v: 2,
            });

            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            if (cached) {
                const data = JSON.parse(cached);
                return res.status(200).json(data);
            }

            const [board, sprint] = await Promise.all([
                Board.findOne(
                    {
                        _id: new Types.ObjectId(boardId),
                        companyId: new Types.ObjectId(companyId),
                        projectId: new Types.ObjectId(projectId),
                    },
                    { boardType: 1 }
                ).lean(),
                Sprints.findOne(
                    {
                        _id: new Types.ObjectId(sprintId),
                        companyId: new Types.ObjectId(companyId),
                        projectId: new Types.ObjectId(projectId),
                    },
                    { burnupData: 1, startDate: 1, endDate: 1, hours: 1, committedVsCompletedMetrics: 1 }
                ).lean(),
            ]);

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }
            if (board.boardType === 'kanban') {
                return res.status(400).json({ error: 'Burnup is supported only for Scrum (sprint) boards.' });
            }
            if (!sprint) {
                return res.status(404).json({ error: 'Sprint not found.' });
            }

            const dateDetails = {
                startDate: sprint.startDate ? sprint.startDate.toISOString().split('T')[0] : null,
                endDate: sprint.endDate ? sprint.endDate.toISOString().split('T')[0] : null,
            };

            const dailyDataToUse = sprint.burnupData?.dailyData || [];
            const apiFromStored = burnupStoredToApiResponse(dailyDataToUse, dateDetails, developer);

            // Azure Boards: if sprint is effectively fully completed (committed == completed),
            // ensure the last day "Actual" meets the "Ideal" line (similar intent as burndown last-day adjustment).
            const isAzureBoard = String(board?.boardType || '').toLowerCase().includes('azure');
            const metrics = sprint?.committedVsCompletedMetrics || null;
            if (isAzureBoard && metrics && Array.isArray(apiFromStored) && apiFromStored.length > 0) {
                const estimationType = sprint?.hours === true ? 'hours' : 'storyPoints';
                const committed = estimationType === 'hours'
                    ? Number(metrics.committedHours || 0)
                    : Number(metrics.committedStoryPoints || 0);
                const completed = estimationType === 'hours'
                    ? Number(metrics.completedHours || 0)
                    : Number(metrics.completedStoryPoints || 0);
                if (Number.isFinite(committed) && Number.isFinite(completed) && committed > 0 && Math.abs(committed - completed) < 0.01) {
                    const last = apiFromStored[apiFromStored.length - 1];
                    if (last) {
                        const idealSP = Number(last.idealLineSP || 0);
                        const idealHrs = Number(last.idealLineHrs || 0);
                        const targetSP = Number.isFinite(idealSP) && idealSP > 0 ? idealSP : committed;
                        const targetHrs = Number.isFinite(idealHrs) && idealHrs > 0 ? idealHrs : committed;
                        last.completedWorkCumulativeSP = targetSP;
                        last.completedWorkCumulativeSPWithEpic = targetSP;
                        last.completedWorkCumulativeHrs = targetHrs;
                        last.completedWorkCumulativeHrsWithEpic = targetHrs;
                    }
                }
            }

            try {
                await redis.set(cacheKey, JSON.stringify(apiFromStored), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }

            return res.status(200).json(apiFromStored);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new BurnupChartController();
