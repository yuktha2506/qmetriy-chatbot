export default async function cxoDataLogic({ builder, params, shared }) {
    try {
        const { companyId, projectId, boardId, sprintId, releaseId } = params;

        const baseQuery = { companyId, projectId };
        if (boardId) {
            baseQuery.boardId = boardId;
        }

        let response = null;

        if (sprintId) {
            response = await builder.Cxo.find({ ...baseQuery, sprintId })
                .sort({ createdAt: -1 })
                .limit(1);
        } else if (releaseId) {
            const releaseData = shared.releaseData;
            response = await builder.Cxo.find({
                ...baseQuery,
                releaseVersion: releaseData?.releaseName,
            })
                .sort({ createdAt: -1 })
                .limit(1);
        } else {
            console.error('Sprint or release not defined');
        }

        let savedCXO = null;
        if (Array.isArray(response) && response.length > 0) {
            savedCXO = response[0];
        }

        return { savedCXO, ...response };
    } catch (error) {
        console.error('Error in cxoDataLogic:', error);
        return null;
    }
}
