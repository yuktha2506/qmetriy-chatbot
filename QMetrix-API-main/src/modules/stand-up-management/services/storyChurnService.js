import { JiraReleaseModel, SprintModel, BoardModel } from '../../project-management/jira/model.js';
import { Types } from 'mongoose';

class StoryChurnService {
    isBugIssueType(issueType) {
        if (!issueType) {
            return false;
        }
        const normalized = String(issueType).trim().toLowerCase();
        return (normalized === 'bug' || normalized === 'bugs' || normalized === 'defect' || normalized === 'defects' || normalized === 'story defect' || normalized === 'story defects'
        );
    }

    async getStoryChurn(selectedType, selectedSprintId, selectedReleaseId, projectId, boardId, companyId, tenantConnection, standupPageRole) {
        try {
            if (standupPageRole && typeof standupPageRole === 'string') {
                standupPageRole = standupPageRole.replace(/^['"]|['"]$/g, '');
            }

            let res = [];
            if (selectedType === 'sprint') {
                res = await this.getSprintStoryChurn(selectedSprintId, projectId, boardId, companyId, tenantConnection, standupPageRole);
            } else if (selectedType === 'release') {
                res = await this.getReleaseStoryChurn(selectedReleaseId, projectId, boardId, companyId, tenantConnection, standupPageRole);
            } else {
                throw new Error('Invalid selected type. Must be either "sprint" or "release".');
            }
            return res;
        } catch (error) {
            console.error('Story churn retrieval error:', error);
            throw error;
        }
    }

    async getStoryChurnExcludingBugs(selectedType, selectedSprintId, selectedReleaseId, projectId, boardId, companyId, tenantConnection, standupPageRole) {
        try {
            if (standupPageRole && typeof standupPageRole === 'string') {
                standupPageRole = standupPageRole.replace(/^['"]|['"]$/g, '');
            }

            let res = [];
            if (selectedType === 'sprint') {
                res = await this.getSprintStoryChurnExcludingBugs(selectedSprintId, projectId, boardId, companyId, tenantConnection, standupPageRole);
            } else if (selectedType === 'release') {
                res = await this.getReleaseStoryChurnExcludingBugs(selectedReleaseId, projectId, boardId, companyId, tenantConnection, standupPageRole);
            } else {
                throw new Error('Invalid selected type. Must be either "sprint" or "release".');
            }
            return res;
        } catch (error) {
            console.error('Story churn retrieval error (excluding bugs):', error);
            throw error;
        }
    }

    async getSprintStoryChurn(selectedSprintId, projectId, boardId, companyId, tenantConnection, standupPageRole = 'team') {
        try {
            const projectObjId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
            const boardObjId = boardId ? (typeof boardId === 'string' ? new Types.ObjectId(boardId) : boardId) : null;
            const companyObjId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
            const sprintObjId = new Types.ObjectId(selectedSprintId);
            const Sprint = SprintModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            
            // Only fetch board info if boardId is provided (not GitLab Issues)
            let boardDoc = null;
            let isAzure = false;
            if (boardObjId) {
                boardDoc = await Board.findOne({ _id: boardObjId }, { boardType: 1 }).lean();
                isAzure = (boardDoc?.boardType || '').toLowerCase() === 'azure-board';
            }
            const mapType = (t) => (isAzure && String(t).toLowerCase() === 'story' ? 'User Story' : t);
            const norm = (s) =>
                String(s || '')
                    .trim()
                    .toLowerCase();
            const simplifyName = (s) => norm(s).replace(/[_.]+/g, ' ').replace(/\s+/g, ' ');
            const deriveEmail = (raw) => {
                const str = String(raw || '').trim();
                if (/@/.test(str)) {
                    return norm(str);
                }
                const parts = str.split(/\s+/);
                if (parts.length === 2 && parts[1].includes('.')) {
                    return norm(`${parts[0]}@${parts[1]}`);
                }
                return null;
            };
            
            // Get members from board if available, otherwise empty array
            let members = [];
            if (boardObjId) {
                const boardWithAssignees = await Board.findOne({ _id: boardObjId }, { assignees: 1 }).lean();
                members = boardWithAssignees?.assignees || [];
            }
            
            const resolveDev = (val) => {
                if (val === 'team') {
                    return 'team';
                }
                const email = deriveEmail(val);
                if (email) {
                    const hit = members.find((m) => norm(m.emailAddress) === email);
                    if (hit?.displayName) {
                        return hit.displayName;
                    }
                }
                const hit2 = members.find((m) => simplifyName(m.displayName) === simplifyName(val));
                return hit2?.displayName || val;
            };
            const resolvedDev = resolveDev(standupPageRole);

            // Build sprint query - conditionally include boardId
            const sprintQuery = {
                _id: sprintObjId,
                projectId: projectObjId,
                companyId: companyObjId,
            };
            if (boardObjId) {
                sprintQuery.boardId = boardObjId;
            }
            const selectedSprintDoc = await Sprint.findOne(sprintQuery).select('startDate sprintId endDate state id name');

            if (!selectedSprintDoc) {
                return { message: 'Selected sprint not found in DB' };
            }

            // Build sprints query - conditionally include boardId
            const sprintsQuery = {
                projectId: projectObjId,
                companyId: companyObjId,
                startDate: { $lte: selectedSprintDoc.startDate },
                state: { $in: ['active', 'closed', 'current', 'past'] }
            };
            if (boardObjId) {
                sprintsQuery.boardId = boardObjId;
            }
            const sprints = await Sprint.find(sprintsQuery)
                .sort({ startDate: -1 })
                .limit(6)
                .select('sprintId startDate endDate state id storyChurn name')
                .lean();

            sprints.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            const descendingSprints = [...sprints].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

            const allIssueTypes = new Set();
            sprints.forEach(sprint => {
                sprint.storyChurn?.forEach(churn => {
                    if (churn.issueType) {allIssueTypes.add(churn.issueType);}
                });
            });
            const issueTypes = Array.from(allIssueTypes);

            const result = sprints.map((sprint) => {
                const row = { label: sprint.name };
                issueTypes.forEach((type) => (row[type] = 0)); // default init

                sprint.storyChurn?.forEach((churn) => {
                    if (churn.issueType) {
                        let totalPlanned = 0,
                            totalAdded = 0,
                            totalRemoved = 0;

                        if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                            if (standupPageRole === 'team') {
                                churn.developerChurn.forEach((dev) => {
                                    totalPlanned += dev.planned || 0;
                                    totalAdded += dev.added || 0;
                                    totalRemoved += dev.removed || 0;
                                });
                            } else {
                                const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                                if (devChurn) {
                                    totalPlanned = devChurn.planned || 0;
                                    totalAdded = devChurn.added || 0;
                                    totalRemoved = devChurn.removed || 0;
                                }
                            }
                        } else if (standupPageRole === 'team') {
                            totalPlanned = churn.planned || 0;
                            totalAdded = churn.added || 0;
                            totalRemoved = churn.removed || 0;
                        }

                        const rate = totalPlanned === 0 ? 0 : ((totalAdded + totalRemoved) / totalPlanned) * 100;
                        const label = mapType(churn.issueType);
                        row[label] = parseFloat(rate.toFixed(1));
                    }
                });

                return row;
            });

            const transformed = descendingSprints.map(sprint => {
                const churnMap = {};

                sprint.storyChurn?.forEach((churn) => {
                    if (!churn.issueType) {
                        return;
                    }
                    const issueType = mapType(churn.issueType);
                    if (!churnMap[issueType]) {
                        churnMap[issueType] = { planned: 0, added: 0, removed: 0 };
                    }

                    if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                        if (standupPageRole === 'team') {
                            churn.developerChurn.forEach((dev) => {
                                churnMap[issueType].planned += dev.planned || 0;
                                churnMap[issueType].added += dev.added || 0;
                                churnMap[issueType].removed += dev.removed || 0;
                            });
                        } else {
                            const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                            if (devChurn) {
                                churnMap[issueType].planned += devChurn.planned || 0;
                                churnMap[issueType].added += devChurn.added || 0;
                                churnMap[issueType].removed += devChurn.removed || 0;
                            }
                        }
                    } else if (standupPageRole === 'team') {
                        // Azure fallback: aggregate top-level counts
                        churnMap[issueType].planned += churn.planned || 0;
                        churnMap[issueType].added += churn.added || 0;
                        churnMap[issueType].removed += churn.removed || 0;
                    }
                });

                const churnData = Object.entries(churnMap).map(([issueType, data]) => {
                    const churnRate = data.planned === 0 ? 0 : ((data.added + data.removed) / data.planned) * 100;
                    return {
                        issueType,
                        planned: data.planned,
                        added: data.added,
                        removed: data.removed,
                        churnRate: parseFloat(churnRate.toFixed(1))
                    };
                });

                return {
                    sprint: sprint.name,
                    churnData
                };
            });
            return { overAllData: result, tableData: transformed };
        } catch (error) {
            console.error('Error in getSprintStoryChurn:', error);
            throw error;
        }
    }

    async getSprintStoryChurnExcludingBugs(selectedSprintId, projectId, boardId, companyId, tenantConnection, standupPageRole = 'team') {
        try {
            const projectObjId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
            const boardObjId = boardId ? (typeof boardId === 'string' ? new Types.ObjectId(boardId) : boardId) : null;
            const companyObjId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
            const sprintObjId = new Types.ObjectId(selectedSprintId);
            const Sprint = SprintModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            
            // Only fetch board info if boardId is provided (not GitLab Issues)
            let boardDoc = null;
            let isAzure = false;
            if (boardObjId) {
                boardDoc = await Board.findOne({ _id: boardObjId }, { boardType: 1 }).lean();
                isAzure = (boardDoc?.boardType || '').toLowerCase() === 'azure-board';
            }
            const mapType = (t) => (isAzure && String(t).toLowerCase() === 'story' ? 'User Story' : t);
            const norm = (s) =>
                String(s || '')
                    .trim()
                    .toLowerCase();
            const simplifyName = (s) => norm(s).replace(/[_.]+/g, ' ').replace(/\s+/g, ' ');
            const deriveEmail = (raw) => {
                const str = String(raw || '').trim();
                if (/@/.test(str)) {
                    return norm(str);
                }
                const parts = str.split(/\s+/);
                if (parts.length === 2 && parts[1].includes('.')) {
                    return norm(`${parts[0]}@${parts[1]}`);
                }
                return null;
            };
            
            // Get members from board if available, otherwise empty array
            let members = [];
            if (boardObjId) {
                const boardWithAssignees = await Board.findOne({ _id: boardObjId }, { assignees: 1 }).lean();
                members = boardWithAssignees?.assignees || [];
            }
            
            const resolveDev = (val) => {
                if (val === 'team') {
                    return 'team';
                }
                const email = deriveEmail(val);
                if (email) {
                    const hit = members.find((m) => norm(m.emailAddress) === email);
                    if (hit?.displayName) {
                        return hit.displayName;
                    }
                }
                const hit2 = members.find((m) => simplifyName(m.displayName) === simplifyName(val));
                return hit2?.displayName || val;
            };
            const resolvedDev = resolveDev(standupPageRole);

            // Build sprint query - conditionally include boardId
            const sprintQuery = {
                _id: sprintObjId,
                projectId: projectObjId,
                companyId: companyObjId,
            };
            if (boardObjId) {
                sprintQuery.boardId = boardObjId;
            }
            const selectedSprintDoc = await Sprint.findOne(sprintQuery).select('startDate sprintId endDate state id name');

            if (!selectedSprintDoc) {
                return { message: 'Selected sprint not found in DB' };
            }

            // Build sprints query - conditionally include boardId
            const sprintsQuery = {
                projectId: projectObjId,
                companyId: companyObjId,
                startDate: { $lte: selectedSprintDoc.startDate },
                state: { $in: ['active', 'closed', 'current', 'past'] }
            };
            if (boardObjId) {
                sprintsQuery.boardId = boardObjId;
            }
            const sprints = await Sprint.find(sprintsQuery)
                .sort({ startDate: -1 })
                .limit(6)
                .select('sprintId startDate endDate state id storyChurn name')
                .lean();

            sprints.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            const descendingSprints = [...sprints].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

            const allIssueTypes = new Set();
            sprints.forEach(sprint => {
                sprint.storyChurn?.forEach(churn => {
                    if (churn.issueType && !this.isBugIssueType(churn.issueType)) {
                        allIssueTypes.add(churn.issueType);
                    }
                });
            });
            const issueTypes = Array.from(allIssueTypes);

            const result = sprints.map((sprint) => {
                const row = { label: sprint.name };
                issueTypes.forEach((type) => (row[type] = 0)); // default init

                sprint.storyChurn?.forEach((churn) => {
                    if (churn.issueType && !this.isBugIssueType(churn.issueType)) {
                        let totalPlanned = 0,
                            totalAdded = 0,
                            totalRemoved = 0;

                        if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                            if (standupPageRole === 'team') {
                                churn.developerChurn.forEach((dev) => {
                                    totalPlanned += dev.planned || 0;
                                    totalAdded += dev.added || 0;
                                    totalRemoved += dev.removed || 0;
                                });
                            } else {
                                const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                                if (devChurn) {
                                    totalPlanned = devChurn.planned || 0;
                                    totalAdded = devChurn.added || 0;
                                    totalRemoved = devChurn.removed || 0;
                                }
                            }
                        } else if (standupPageRole === 'team') {
                            totalPlanned = churn.planned || 0;
                            totalAdded = churn.added || 0;
                            totalRemoved = churn.removed || 0;
                        }

                        const rate = totalPlanned === 0 ? 0 : ((totalAdded + totalRemoved) / totalPlanned) * 100;
                        const label = mapType(churn.issueType);
                        row[label] = parseFloat(rate.toFixed(1));
                    }
                });

                return row;
            });

            const transformed = descendingSprints.map(sprint => {
                const churnMap = {};

                sprint.storyChurn?.forEach((churn) => {
                    if (!churn.issueType || this.isBugIssueType(churn.issueType)) {
                        return;
                    }
                    const issueType = mapType(churn.issueType);
                    if (!churnMap[issueType]) {
                        churnMap[issueType] = { planned: 0, added: 0, removed: 0 };
                    }

                    if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                        if (standupPageRole === 'team') {
                            churn.developerChurn.forEach((dev) => {
                                churnMap[issueType].planned += dev.planned || 0;
                                churnMap[issueType].added += dev.added || 0;
                                churnMap[issueType].removed += dev.removed || 0;
                            });
                        } else {
                            const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                            if (devChurn) {
                                churnMap[issueType].planned += devChurn.planned || 0;
                                churnMap[issueType].added += devChurn.added || 0;
                                churnMap[issueType].removed += devChurn.removed || 0;
                            }
                        }
                    } else if (standupPageRole === 'team') {
                        // Azure fallback: aggregate top-level counts
                        churnMap[issueType].planned += churn.planned || 0;
                        churnMap[issueType].added += churn.added || 0;
                        churnMap[issueType].removed += churn.removed || 0;
                    }
                });

                const churnData = Object.entries(churnMap).map(([issueType, data]) => {
                    const churnRate = data.planned === 0 ? 0 : ((data.added + data.removed) / data.planned) * 100;
                    return {
                        issueType,
                        planned: data.planned,
                        added: data.added,
                        removed: data.removed,
                        churnRate: parseFloat(churnRate.toFixed(1))
                    };
                });

                return {
                    sprint: sprint.name,
                    churnData
                };
            });
            return { overAllData: result, tableData: transformed };
        } catch (error) {
            console.error('Error in getSprintStoryChurnExcludingBugs:', error);
            throw error;
        }
    }

    async getReleaseStoryChurn(selectedReleaseId, projectId, boardId, companyId, tenantConnection, standupPageRole = 'team') {
        try {
            const projectObjId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
            const boardObjId = boardId ? (typeof boardId === 'string' ? new Types.ObjectId(boardId) : boardId) : null;
            const companyObjId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
            const releaseObjId = new Types.ObjectId(selectedReleaseId);

            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            
            // Only fetch board info if boardId is provided (not GitLab Issues)
            let boardDoc = null;
            let isAzure = false;
            if (boardObjId) {
                boardDoc = await Board.findOne({ _id: boardObjId }, { boardType: 1 }).lean();
                isAzure = (boardDoc?.boardType || '').toLowerCase() === 'azure-board';
            }
            const mapType = (t) => (isAzure && String(t).toLowerCase() === 'story' ? 'User Story' : t);
            // Developer resolution and normalization
            const norm = (s) =>
                String(s || '')
                    .trim()
                    .toLowerCase();
            const simplifyName = (s) => norm(s).replace(/[_.]+/g, ' ').replace(/\s+/g, ' ');
            const deriveEmail = (raw) => {
                const str = String(raw || '').trim();
                if (/@/.test(str)) {
                    return norm(str);
                }
                const parts = str.split(/\s+/);
                if (parts.length === 2 && parts[1].includes('.')) {
                    return norm(`${parts[0]}@${parts[1]}`);
                }
                return null;
            };
            
            // Get members from board if available, otherwise empty array
            let members = [];
            if (boardObjId) {
                const boardWithAssignees = await Board.findOne({ _id: boardObjId }, { assignees: 1 }).lean();
                members = boardWithAssignees?.assignees || [];
            }
            
            const resolveDev = (val) => {
                if (val === 'team') {
                    return 'team';
                }
                const email = deriveEmail(val);
                if (email) {
                    const hit = members.find((m) => norm(m.emailAddress) === email);
                    if (hit?.displayName) {
                        return hit.displayName;
                    }
                }
                const hit2 = members.find((m) => simplifyName(m.displayName) === simplifyName(val));
                return hit2?.displayName || val;
            };
            const resolvedDev = resolveDev(standupPageRole);

            // Build release query - conditionally include boardId
            const releaseQuery = {
                _id: releaseObjId,
                projectId: projectObjId,
                companyId: companyObjId,
            };
            if (boardObjId) {
                releaseQuery.boardId = boardObjId;
            }
            const selectedRelease = await JiraRelease.findOne(releaseQuery)
                .select('releaseName releaseDate')
                .lean();

            if (!selectedRelease) {
                return { message: 'Selected release not found' };
            }

            // Build releases query - conditionally include boardId
            const releasesQuery = {
                projectId: projectObjId,
                companyId: companyObjId,
                releaseDate: { $lte: selectedRelease.releaseDate },
            };
            if (boardObjId) {
                releasesQuery.boardId = boardObjId;
            }
            const releases = await JiraRelease.find(releasesQuery)
                .sort({ releaseDate: -1 })
                .limit(6)
                .select('releaseName releaseDate releaseChurn')
                .lean();

            if (!releases || !releases.length) {
                return { message: 'No releases found in DB' };
            }

            releases.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
            const descendingSprints = [...releases].sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

            const allIssueTypes = new Set();
            releases.forEach((release) => {
                if (!Array.isArray(release.releaseChurn)) {
                    return;
                }
                release.releaseChurn.forEach((churn) => {
                    if (churn.issueType) {
                        allIssueTypes.add(mapType(churn.issueType));
                    }
                });
            });
            const issueTypes = Array.from(allIssueTypes);

            const result = releases.map(release => {
                const row = { label: release.releaseName };
                issueTypes.forEach(type => row[type] = 0); // init 0

                release?.releaseChurn?.forEach((churn) => {
                    if (churn.issueType) {
                        let totalPlanned = 0,
                            totalAdded = 0,
                            totalRemoved = 0;

                        if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                            if (standupPageRole === 'team') {
                                churn.developerChurn.forEach((dev) => {
                                    totalPlanned += dev.planned || 0;
                                    totalAdded += dev.added || 0;
                                    totalRemoved += dev.removed || 0;
                                });
                            } else {
                                const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                                if (devChurn) {
                                    totalPlanned = devChurn.planned || 0;
                                    totalAdded = devChurn.added || 0;
                                    totalRemoved = devChurn.removed || 0;
                                }
                            }
                        } else if (standupPageRole === 'team') {
                            // Azure fallback: use aggregated counts
                            totalPlanned = churn.planned || 0;
                            totalAdded = churn.added || 0;
                            totalRemoved = churn.removed || 0;
                        }

                        const rate = totalPlanned === 0 ? 0 : ((totalAdded + totalRemoved) / totalPlanned) * 100;
                        const label = mapType(churn.issueType);
                        row[label] = parseFloat(rate.toFixed(1));
                    }
                });

                return row;
            });

            const transformed = descendingSprints.map(release => {
                const churnMap = {};

                release?.releaseChurn?.forEach(churn => {
                    if (!churn.issueType || !Array.isArray(churn.developerChurn)) {return;}

                    const issueType = churn.issueType;
                    if (!churnMap[issueType]) {
                        churnMap[issueType] = { planned: 0, added: 0, removed: 0 };
                    }

                    if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                        if (standupPageRole === 'team') {
                            churn.developerChurn.forEach((dev) => {
                                churnMap[issueType].planned += dev.planned || 0;
                                churnMap[issueType].added += dev.added || 0;
                                churnMap[issueType].removed += dev.removed || 0;
                            });
                        } else {
                            const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                            if (devChurn) {
                                churnMap[issueType].planned += devChurn.planned || 0;
                                churnMap[issueType].added += devChurn.added || 0;
                                churnMap[issueType].removed += devChurn.removed || 0;
                            }
                        }
                    } else if (standupPageRole === 'team') {
                        // Azure fallback: aggregate top-level counts
                        churnMap[issueType].planned += churn.planned || 0;
                        churnMap[issueType].added += churn.added || 0;
                        churnMap[issueType].removed += churn.removed || 0;
                    }
                });

                const churnData = Object.entries(churnMap).map(([issueType, data]) => {
                    const churnRate = data.planned === 0 ? 0 : ((data.added + data.removed) / data.planned) * 100;
                    return {
                        issueType,
                        planned: data.planned,
                        added: data.added,
                        removed: data.removed,
                        churnRate: parseFloat(churnRate.toFixed(1)),
                    };
                });

                return {
                    release: release?.releaseName,
                    churnData,
                };
            });

            return { overAllData: result, tableData: transformed };
        } catch (error) {
            console.error('Error in getReleaseStoryChurn:', error);
            throw error;
        }
    }

    async getReleaseStoryChurnExcludingBugs(selectedReleaseId, projectId, boardId, companyId, tenantConnection, standupPageRole = 'team') {
        try {
            const projectObjId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
            const boardObjId = boardId ? (typeof boardId === 'string' ? new Types.ObjectId(boardId) : boardId) : null;
            const companyObjId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
            const releaseObjId = new Types.ObjectId(selectedReleaseId);

            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            
            // Only fetch board info if boardId is provided (not GitLab Issues)
            let boardDoc = null;
            let isAzure = false;
            if (boardObjId) {
                boardDoc = await Board.findOne({ _id: boardObjId }, { boardType: 1 }).lean();
                isAzure = (boardDoc?.boardType || '').toLowerCase() === 'azure-board';
            }
            const mapType = (t) => (isAzure && String(t).toLowerCase() === 'story' ? 'User Story' : t);
            // Developer resolution and normalization
            const norm = (s) =>
                String(s || '')
                    .trim()
                    .toLowerCase();
            const simplifyName = (s) => norm(s).replace(/[_.]+/g, ' ').replace(/\s+/g, ' ');
            const deriveEmail = (raw) => {
                const str = String(raw || '').trim();
                if (/@/.test(str)) {
                    return norm(str);
                }
                const parts = str.split(/\s+/);
                if (parts.length === 2 && parts[1].includes('.')) {
                    return norm(`${parts[0]}@${parts[1]}`);
                }
                return null;
            };
            
            // Get members from board if available, otherwise empty array
            let members = [];
            if (boardObjId) {
                const boardWithAssignees = await Board.findOne({ _id: boardObjId }, { assignees: 1 }).lean();
                members = boardWithAssignees?.assignees || [];
            }
            
            const resolveDev = (val) => {
                if (val === 'team') {
                    return 'team';
                }
                const email = deriveEmail(val);
                if (email) {
                    const hit = members.find((m) => norm(m.emailAddress) === email);
                    if (hit?.displayName) {
                        return hit.displayName;
                    }
                }
                const hit2 = members.find((m) => simplifyName(m.displayName) === simplifyName(val));
                return hit2?.displayName || val;
            };
            const resolvedDev = resolveDev(standupPageRole);

            // Build release query - conditionally include boardId
            const releaseQuery = {
                _id: releaseObjId,
                projectId: projectObjId,
                companyId: companyObjId,
            };
            if (boardObjId) {
                releaseQuery.boardId = boardObjId;
            }
            const selectedRelease = await JiraRelease.findOne(releaseQuery)
                .select('releaseName releaseDate')
                .lean();

            if (!selectedRelease) {
                return { message: 'Selected release not found' };
            }

            // Build releases query - conditionally include boardId
            const releasesQuery = {
                projectId: projectObjId,
                companyId: companyObjId,
                releaseDate: { $lte: selectedRelease.releaseDate },
            };
            if (boardObjId) {
                releasesQuery.boardId = boardObjId;
            }
            const releases = await JiraRelease.find(releasesQuery)
                .sort({ releaseDate: -1 })
                .limit(6)
                .select('releaseName releaseDate releaseChurn')
                .lean();

            if (!releases || !releases.length) {
                return { message: 'No releases found in DB' };
            }

            releases.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
            const descendingSprints = [...releases].sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

            const allIssueTypes = new Set();
            releases.forEach((release) => {
                if (!Array.isArray(release.releaseChurn)) {
                    return;
                }
                release.releaseChurn.forEach((churn) => {
                    if (churn.issueType && !this.isBugIssueType(churn.issueType)) {
                        allIssueTypes.add(mapType(churn.issueType));
                    }
                });
            });
            const issueTypes = Array.from(allIssueTypes);

            const result = releases.map(release => {
                const row = { label: release.releaseName };
                issueTypes.forEach(type => row[type] = 0); // init 0

                release?.releaseChurn?.forEach((churn) => {
                    if (churn.issueType && !this.isBugIssueType(churn.issueType)) {
                        let totalPlanned = 0,
                            totalAdded = 0,
                            totalRemoved = 0;

                        if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                            if (standupPageRole === 'team') {
                                churn.developerChurn.forEach((dev) => {
                                    totalPlanned += dev.planned || 0;
                                    totalAdded += dev.added || 0;
                                    totalRemoved += dev.removed || 0;
                                });
                            } else {
                                const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                                if (devChurn) {
                                    totalPlanned = devChurn.planned || 0;
                                    totalAdded = devChurn.added || 0;
                                    totalRemoved = devChurn.removed || 0;
                                }
                            }
                        } else if (standupPageRole === 'team') {
                            // Azure fallback: use aggregated counts
                            totalPlanned = churn.planned || 0;
                            totalAdded = churn.added || 0;
                            totalRemoved = churn.removed || 0;
                        }

                        const rate = totalPlanned === 0 ? 0 : ((totalAdded + totalRemoved) / totalPlanned) * 100;
                        const label = mapType(churn.issueType);
                        row[label] = parseFloat(rate.toFixed(1));
                    }
                });

                return row;
            });

            const transformed = descendingSprints.map(release => {
                const churnMap = {};

                release?.releaseChurn?.forEach(churn => {
                    if (!churn.issueType || this.isBugIssueType(churn.issueType)) {
                        return;
                    }

                    const issueType = mapType(churn.issueType);
                    if (!churnMap[issueType]) {
                        churnMap[issueType] = { planned: 0, added: 0, removed: 0 };
                    }

                    if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                        if (standupPageRole === 'team') {
                            churn.developerChurn.forEach((dev) => {
                                churnMap[issueType].planned += dev.planned || 0;
                                churnMap[issueType].added += dev.added || 0;
                                churnMap[issueType].removed += dev.removed || 0;
                            });
                        } else {
                            const devChurn = churn.developerChurn.find((dev) => simplifyName(dev.developer) === simplifyName(resolvedDev));
                            if (devChurn) {
                                churnMap[issueType].planned += devChurn.planned || 0;
                                churnMap[issueType].added += devChurn.added || 0;
                                churnMap[issueType].removed += devChurn.removed || 0;
                            }
                        }
                    } else if (standupPageRole === 'team') {
                        // Azure fallback: aggregate top-level counts
                        churnMap[issueType].planned += churn.planned || 0;
                        churnMap[issueType].added += churn.added || 0;
                        churnMap[issueType].removed += churn.removed || 0;
                    }
                });

                const churnData = Object.entries(churnMap).map(([issueType, data]) => {
                    const churnRate = data.planned === 0 ? 0 : ((data.added + data.removed) / data.planned) * 100;
                    return {
                        issueType,
                        planned: data.planned,
                        added: data.added,
                        removed: data.removed,
                        churnRate: parseFloat(churnRate.toFixed(1)),
                    };
                });

                return {
                    release: release?.releaseName,
                    churnData,
                };
            });

            return { overAllData: result, tableData: transformed };
        } catch (error) {
            console.error('Error in getReleaseStoryChurnExcludingBugs:', error);
            throw error;
        }
    }
}

export default new StoryChurnService();
