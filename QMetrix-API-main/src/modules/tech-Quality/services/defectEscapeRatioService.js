class DefectEscapeRatioService {
    async calculateDefectEscapeRatio(workStartedIssues) {
        let totalBugs = 0;
        let escapedBugs = 0;
        const prodRegex = /^(prod)/i;
        workStartedIssues.forEach((issue) => {
            if (issue.type?.name?.toLowerCase() === 'bug' || issue.type?.name?.toLowerCase() === 'defect') {
                totalBugs++;

                const labels = issue.label || [];
                const isEscaped = labels.some((label) => prodRegex.test(label));
                if (isEscaped) {
                    escapedBugs++;
                }
            }
        });
        return {
            escapedDefects: escapedBugs,
            totalDefects: totalBugs,
            defectEscapeRatio: totalBugs > 0 ? Math.round((escapedBugs / totalBugs) * 100) : 0,
        };
    }
}

export default new DefectEscapeRatioService();
