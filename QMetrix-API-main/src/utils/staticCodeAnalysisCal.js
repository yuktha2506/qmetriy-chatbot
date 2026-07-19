export const duplicatedFilesScore = (value) => {
    if (value < 10) {
        return 100;
    } else if (value >= 10 && value < 20) {
        return 75;
    } else if (value >= 20 && value < 50) {
        return 50;
    } else if (value >= 50 && value < 100) {
        return 25;
    } else if (value >= 100) {
        return 0;
    } else {
        throw new Error('Invalid duplicated files value');
    }
};

export const vulnerabilitiesScore = (value) => {
    if (value === 0) {
        return 100;
    } else if (value >= 1 && value <= 3) {
        return 75;
    } else if (value >= 4 && value <= 10) {
        return 50;
    } else if (value >= 11 && value <= 20) {
        return 25;
    } else if (value > 20) {
        return 0;
    } else {
        throw new Error('Invalid vulnerabilities value');
    }
};

export const securityHotspotsScore = (value) => {
    if (value === 0) {
        return 100;
    } else if (value >= 1 && value <= 5) {
        return 75;
    } else if (value >= 6 && value <= 10) {
        return 50;
    } else if (value >= 11 && value <= 20) {
        return 25;
    } else if (value > 20) {
        return 0;
    } else {
        throw new Error('Invalid security hotspots value');
    }
};

export const duplicatedBlocksScore = (value) => {
    if (value < 50) {
        return 100;
    } else if (value >= 50 && value < 100) {
        return 75;
    } else if (value >= 100 && value < 300) {
        return 50;
    } else if (value >= 300 && value < 500) {
        return 25;
    } else if (value >= 500) {
        return 0;
    } else {
        throw new Error('Invalid duplicated blocks value');
    }
};

export const duplicatedLinesScore = (value) => {
    if (value < 100) {
        return 100;
    } else if (value >= 100 && value < 500) {
        return 75;
    } else if (value >= 500 && value < 1000) {
        return 50;
    } else if (value >= 1000 && value < 5000) {
        return 25;
    } else if (value >= 5000) {
        return 0;
    } else {
        throw new Error('Invalid duplicated lines value');
    }
};

export const codeSmellsScore = (value) => {
    if (value < 50) {
        return 100;
    } else if (value >= 50 && value < 100) {
        return 75;
    } else if (value >= 100 && value < 200) {
        return 50;
    } else if (value >= 200 && value < 500) {
        return 25;
    } else if (value >= 500) {
        return 0;
    } else {
        throw new Error('Invalid code smells value');
    }
};
