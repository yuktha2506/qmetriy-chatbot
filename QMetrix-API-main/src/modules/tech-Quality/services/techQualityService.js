import { ProjectModel } from '../../project-management/jira/model';
import { TechQualityModel } from '../model';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

function getTtrValue(doc, severity) {
    const ttr = doc?.techQuality?.timeToResolution;
    if (!ttr) {return 0;}
    if (severity === 'overall') {return ttr.overall?.avgResolutionDays ?? 0;}
    return ttr.bySeverity?.[severity]?.avgResolutionDays ?? 0;
}

function round2(n) {
    return Math.round((n ?? 0) * 100) / 100;
}

function getTtrResolvedData(doc, severity) {
    const ttr = doc?.techQuality?.timeToResolution;
    if (!ttr) { return { count: 0, totalDays: 0 }; }
    if (severity === 'overall') {
        const count = ttr.overall?.resolvedBugs ?? 0;
        const totalResolutionDays = ttr.overall?.totalResolutionDays;
        const totalDays = totalResolutionDays !== null ? totalResolutionDays : count * (ttr.overall?.avgResolutionDays ?? 0);
        return { count, totalDays };
    }
    const s = ttr.bySeverity?.[severity];
    const count = s?.resolvedBugs ?? 0;
    const totalResolutionDays = s?.totalResolutionDays;
    const totalDays = totalResolutionDays !== null ? totalResolutionDays : count * (s?.avgResolutionDays ?? 0);
    return { count, totalDays };
}

class TechQualityService {
    async getTechQuality(tenantConnection, companyId, projectId, boardId) {
        try {
            const ProjectModal = ProjectModel(tenantConnection);
            const TechQuality = TechQualityModel(tenantConnection);

            // ---------- 1. Calculate effective year start ----------
            const project = await ProjectModal.findOne({ companyId, _id: projectId }, { firstIssueCreatedAt: 1 });
            const firstIssueDate = new Date(project.firstIssueCreatedAt);
            const today = new Date();
            const threeYearsAgo = new Date(Date.UTC(today.getUTCFullYear() - 3, today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
            const effectiveStartDate = new Date(Math.max(firstIssueDate.getTime(), threeYearsAgo.getTime()));

            const yearStart = new Date(Date.UTC(effectiveStartDate.getUTCFullYear(), 0, 1, 0, 0, 0, 0));

            // ---------- 2. Fetch data ----------
            const yearlyDocs = await TechQuality.find({
                companyId,
                projectId,
                boardId,
                periodType: 'year',
                periodStartDate: { $gte: yearStart, $lte: today },
            });

            const monthlyDocs = await TechQuality.find({
                companyId,
                projectId,
                boardId,
                periodType: 'month',
            })
                .sort({ periodStartDate: -1 })
                .limit(12);

            const quarterlyDocs = await TechQuality.find({
                companyId,
                projectId,
                boardId,
                periodType: 'quarter',
            })
                .sort({ periodStartDate: -1 })
                .limit(12);

            // ---------- 3. Yearly + Overall ----------
            let totalDerEscaped = 0,
                totalDerDefects = 0;
            let totalDarAccepted = 0,
                totalDarDefects = 0;
            let totalBugsCreated = 0,
                totalClosedStories = 0;

            const defectEscapeRatioYearly = [];
            const defectAcceptanceRatioYearly = [];
            const bugRateYearly = [];
            const timeToResolutionYearly = [];

            let ttrTotalResolvedOverall = 0;
            let ttrTotalDaysOverall = 0;
            const ttrBySeveritySums = { critical: { count: 0, totalDays: 0 }, high: { count: 0, totalDays: 0 }, medium: { count: 0, totalDays: 0 }, low: { count: 0, totalDays: 0 } };

            for (const doc of yearlyDocs) {
                const year = Number(doc.year);
                const der = doc.techQuality.defectEscapeRatio;
                const dar = doc.techQuality.defectAcceptanceRatio;
                const br = doc.techQuality.bugRate;

                const derValue = der.totalDefects === 0 ? 0 : (der.escapedDefects / der.totalDefects) * 100;

                const darValue = dar.totalDefects === 0 ? 0 : (dar.acceptedDefects / dar.totalDefects) * 100;

                const brValue = br.closedStories === 0 ? 0 : br.bugsCreated / br.closedStories;

                defectEscapeRatioYearly.push({ period: year, value: +derValue.toFixed(2) });
                defectAcceptanceRatioYearly.push({ period: year, value: +darValue.toFixed(2) });
                bugRateYearly.push({ period: year, value: +brValue.toFixed(2) });

                timeToResolutionYearly.push({
                    period: year,
                    bySeverity: {
                        critical: { value: round2(getTtrValue(doc, 'critical')) },
                        high: { value: round2(getTtrValue(doc, 'high')) },
                        medium: { value: round2(getTtrValue(doc, 'medium')) },
                        low: { value: round2(getTtrValue(doc, 'low')) },
                    },
                });

                const overallData = getTtrResolvedData(doc, 'overall');
                ttrTotalResolvedOverall += overallData.count;
                ttrTotalDaysOverall += overallData.totalDays;
                SEVERITIES.forEach((sev) => {
                    const d = getTtrResolvedData(doc, sev);
                    ttrBySeveritySums[sev].count += d.count;
                    ttrBySeveritySums[sev].totalDays += d.totalDays;
                });

                totalDerEscaped += der.escapedDefects;
                totalDerDefects += der.totalDefects;
                totalDarAccepted += dar.acceptedDefects;
                totalDarDefects += dar.totalDefects;
                totalBugsCreated += br.bugsCreated;
                totalClosedStories += br.closedStories;
            }

            const overallDER = totalDerDefects === 0 ? 0 : +((totalDerEscaped / totalDerDefects) * 100).toFixed(2);
            const overallDAR = totalDarDefects === 0 ? 0 : +((totalDarAccepted / totalDarDefects) * 100).toFixed(2);
            const overallBugRate = totalClosedStories === 0 ? 0 : +(totalBugsCreated / totalClosedStories).toFixed(2);

            // ---------- 4. Monthly ----------
            const monthly = monthlyDocs
                .sort((a, b) => new Date(a.periodStartDate) - new Date(b.periodStartDate))
                .map((doc) => {
                    const month = new Date(doc.periodStartDate).toLocaleString('en-US', { month: 'short' });
                    const ttrOverall = round2(getTtrValue(doc, 'overall'));
                    const ttrBySeverity = {
                        critical: { value: round2(getTtrValue(doc, 'critical')) },
                        high: { value: round2(getTtrValue(doc, 'high')) },
                        medium: { value: round2(getTtrValue(doc, 'medium')) },
                        low: { value: round2(getTtrValue(doc, 'low')) },
                    };
                    return {
                        period: `${month} ${doc.year}`,
                        year: Number(doc.year),
                        der: +doc.techQuality.defectEscapeRatio.defectEscapeRatio.toFixed(2),
                        dar: +doc.techQuality.defectAcceptanceRatio.acceptanceRatio.toFixed(2),
                        bugRate: +doc.techQuality.bugRate.bugRateValue.toFixed(2),
                        ttrOverall,
                        ttrBySeverity,
                    };
                });

            // ---------- 5. Quarterly ----------
            const quarterly = quarterlyDocs
                .sort((a, b) => new Date(a.periodStartDate) - new Date(b.periodStartDate))
                .map((doc) => {
                    const ttrBySeverity = {
                        critical: { value: round2(getTtrValue(doc, 'critical')) },
                        high: { value: round2(getTtrValue(doc, 'high')) },
                        medium: { value: round2(getTtrValue(doc, 'medium')) },
                        low: { value: round2(getTtrValue(doc, 'low')) },
                    };
                    return {
                        period: `${doc.periodName} ${doc.year}`,
                        der: +doc.techQuality.defectEscapeRatio.defectEscapeRatio.toFixed(2),
                        dar: +doc.techQuality.defectAcceptanceRatio.acceptanceRatio.toFixed(2),
                        bugRate: +doc.techQuality.bugRate.bugRateValue.toFixed(2),
                        ttrBySeverity,
                    };
                });

            // ---------- 6. Month change ----------

            const getMonthOverMonthChange = (monthly) => {
                if (monthly.length < 2) {
                    return {
                        difference: 0,
                        status: 'no-data',
                    };
                }

                const current = monthly[monthly.length - 1];
                const previous = monthly[monthly.length - 2];

                const calc = (curr, prev) => {
                    if (prev === 0) {
                        return { difference: 0, status: 'no-data' };
                    }

                    const diff = ((curr - prev) / prev) * 100;

                    let status = 'NA';
                    if (curr > prev) {
                        status = true;
                    }
                    if (curr < prev) {
                        status = false;
                    }
                    if (curr === prev) {
                        status = 0;
                    }

                    return {
                        difference: Number(diff.toFixed(2)),
                        status,
                    };
                };

                return {
                    defectEscapeRatio: calc(current.der, previous.der),
                    defectAcceptanceRatio: calc(current.dar, previous.dar),
                    bugRate: calc(current.bugRate, previous.bugRate),
                };
            };

            const monthOverMonth = getMonthOverMonthChange(monthly);

            // ---------- 7. High / Low for current year ----------

            const currentYear = today.getUTCFullYear();

            const currentYearMonthly = monthly.filter((m) => {
                const year = Number(m.period.split(' ')[1]);
                return year === currentYear;
            });

            const getHighLow = (arr, key) => {
                if (!arr.length) {
                    return { high: 0, low: 0 };
                }

                const values = arr.map((item) => item[key]);

                return {
                    high: Number(Math.max(...values).toFixed(2)),
                    low: Number(Math.min(...values).toFixed(2)),
                };
            };

            const derHighLow = getHighLow(currentYearMonthly, 'der');
            const darHighLow = getHighLow(currentYearMonthly, 'dar');
            const bugRateHighLow = getHighLow(currentYearMonthly, 'bugRate');

            // ---------- 8. TimeToResolution (same data, same scoping as DER/DAR/bugRate) ----------
            const ttrLifetimeOverall = ttrTotalResolvedOverall > 0 ? round2(ttrTotalDaysOverall / ttrTotalResolvedOverall) : 0;
            const ttrLifetimeBySeverity = {};
            SEVERITIES.forEach((sev) => {
                const { count, totalDays } = ttrBySeveritySums[sev];
                ttrLifetimeBySeverity[sev] = count > 0 ? round2(totalDays / count) : 0;
            });

            const ttrCalc = (curr, prev) => {
                if (prev === 0) {
                    return { difference: 0, status: 'no-data' };
                }
                const diff = ((curr - prev) / prev) * 100;
                let status = 'NA';
                if (curr > prev) {
                    status = false;
                }
                if (curr < prev) {
                    status = true;
                }
                return { difference: Number(diff.toFixed(2)), status };
            };

            const ttrTrendOverall = monthly.length >= 2 ? ttrCalc(monthly[monthly.length - 1].ttrOverall, monthly[monthly.length - 2].ttrOverall) : { difference: 0, status: 'no-data' };
            const ttrTrendBySeverity = {};
            SEVERITIES.forEach((sev) => {
                ttrTrendBySeverity[sev] =
                    monthly.length >= 2 ? ttrCalc(monthly[monthly.length - 1].ttrBySeverity[sev].value, monthly[monthly.length - 2].ttrBySeverity[sev].value) : { difference: 0, status: 'no-data' };
            });

            const getTtrHighLow = (arr, getValue) => {
                const values = arr.map(getValue).filter((v) => v > 0);
                if (!values.length) {
                    return { high: 0, low: 0 };
                }
                return {
                    high: round2(Math.max(...values)),
                    low: round2(Math.min(...values)),
                };
            };

            const ttrHighLowOverall = getTtrHighLow(currentYearMonthly, (m) => m.ttrOverall);
            const ttrHighLowBySeverity = {};
            SEVERITIES.forEach((sev) => {
                ttrHighLowBySeverity[sev] = getTtrHighLow(currentYearMonthly, (m) => m.ttrBySeverity[sev].value);
            });

            const timeToResolutionMetric = {
                lifetime: ttrLifetimeOverall,
                trend: Math.abs(ttrTrendOverall.difference),
                status: ttrTrendOverall.difference <= 0,
                high: ttrHighLowOverall.high,
                low: ttrHighLowOverall.low,
                bySeverity: {},
            };
            SEVERITIES.forEach((sev) => {
                const trend = ttrTrendBySeverity[sev];
                timeToResolutionMetric.bySeverity[sev] = {
                    lifetime: ttrLifetimeBySeverity[sev],
                    trend: Math.abs(trend.difference),
                    status: trend.difference <= 0,
                    high: ttrHighLowBySeverity[sev].high,
                    low: ttrHighLowBySeverity[sev].low,
                };
            });

            const timeToResolution = {
                metric: timeToResolutionMetric,
                yearly: timeToResolutionYearly,
                quarterly: quarterly.map((q) => ({ period: q.period, bySeverity: q.ttrBySeverity })),
                monthly: monthly.map((m) => ({ period: m.period, bySeverity: m.ttrBySeverity })),
            };

            // ---------- 9. Final Response ----------
            return {
                defectEscapeRatio: {
                    metric: {
                        lifeTime: overallDER,
                        trend: monthOverMonth.defectEscapeRatio?.difference,
                        status: monthOverMonth.defectEscapeRatio?.status,
                        high: derHighLow.high,
                        low: derHighLow.low,
                    },
                    yearly: defectEscapeRatioYearly,
                    quarterly: quarterly.map((q) => ({ period: q.period, value: q.der })),
                    monthly: monthly.map((m) => ({ period: m.period, value: m.der })),
                },
                defectAcceptanceRatio: {
                    metric: {
                        lifeTime: overallDAR,
                        trend: monthOverMonth.defectAcceptanceRatio?.difference,
                        status: monthOverMonth.defectAcceptanceRatio?.status,
                        accepted: totalDarAccepted,
                        reported: totalDarDefects,
                        high: darHighLow.high,
                        low: darHighLow.low,
                    },
                    yearly: defectAcceptanceRatioYearly,
                    quarterly: quarterly.map((q) => ({ period: q.period, value: q.dar })),
                    monthly: monthly.map((m) => ({ period: m.period, value: m.dar })),
                },
                bugRate: {
                    metric: {
                        lifeTime: overallBugRate,
                        trend: monthOverMonth.bugRate?.difference,
                        status: monthOverMonth.bugRate?.status,
                        high: bugRateHighLow.high,
                        low: bugRateHighLow.low,
                    },
                    yearly: bugRateYearly,
                    quarterly: quarterly.map((q) => ({ period: q.period, value: q.bugRate })),
                    monthly: monthly.map((m) => ({ period: m.period, value: m.bugRate })),
                },
                TimeToResolution: timeToResolution,
            };
        } catch (error) {
            console.error('Error in getTechQuality:', error);
            throw error;
        }
    }
}

export default new TechQualityService();
