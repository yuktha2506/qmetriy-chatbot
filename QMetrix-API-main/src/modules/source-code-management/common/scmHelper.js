import { RELEASE_STATUS_RELEASED, STATUS_CLOSED } from '../../../utils/constants/statusConstants.js';

function getSprintDates(sprints, sprintId) {
    const sprintData = sprints.find((sprint) => sprint._id.equals(sprintId));
    if (!sprintData) {
        // throw new Error('Sprint not found');
        console.warn(`Sprint not found for sprintId: ${sprintId}`);
        const currentDate = new Date();
        return { startDate: currentDate, endDate: currentDate };
    }
    const startDate = sprintData.startDate;
    let endDate;
    const currentDate = new Date();
    if (sprintData.state === STATUS_CLOSED) {
        const sortedSprints = [...sprints].filter((s) => new Date(s.startDate) > new Date(sprintData.startDate)).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        endDate = sortedSprints.length > 0 ? sortedSprints[0].startDate : sprintData.endDate;
    } else {
        endDate = currentDate;
    }
    return { startDate, endDate };
}

function getReleaseDates(releaseData, releaseId) {
    const selectedReleaseData = releaseData.find((release) => release._id.equals(releaseId));
    if (!selectedReleaseData) {
        // throw new Error('Release not found');
        console.warn(`Release not found for releaseId: ${releaseId}`);
        const currentDate = new Date();
        return { startDate: currentDate, endDate: currentDate };
    }
    const startDate = selectedReleaseData.startDate;
    let endDate;
    const currentDate = new Date();
    if (selectedReleaseData.status === RELEASE_STATUS_RELEASED) {
        const sortedReleases = [...releaseData].filter((r) => new Date(r.startDate) > new Date(selectedReleaseData.startDate)).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        endDate = sortedReleases.length > 0 ? sortedReleases[0].startDate : selectedReleaseData.releaseDate;
    } else {
        endDate = currentDate;
    }
    return { startDate, endDate };
}

export { getSprintDates, getReleaseDates };
