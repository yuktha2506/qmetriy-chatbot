class DefectAcceptanceRatioService {
    async calculateDefectAcceptanceRatio(workStartedIssues) {
        let totalDefects = 0;
        let acceptedDefects = 0;

        workStartedIssues.forEach((issue) => {
            if (issue.type?.name?.toLowerCase() === 'bug' || issue.type?.name?.toLowerCase() === 'defect') {
                const labels = (issue.label || []).map((l) => l.toLowerCase());

                if (labels.some((label) => /^prod/.test(label))) {
                    totalDefects++;

                    if (issue.isAccepted === true) {
                        acceptedDefects++;
                    }
                }
            }
        });

        return {
            acceptedDefects,
            totalDefects,
            acceptanceRatio: totalDefects > 0 ? Number(((acceptedDefects / totalDefects) * 100).toFixed(2)) : 0,
        };
    }
}

export default new DefectAcceptanceRatioService();
