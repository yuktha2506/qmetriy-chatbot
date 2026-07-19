/**
 * Creates a custom round operator pipeline stage for MongoDB aggregation
 * @param {string} fieldToRound - The field name to round
 * @param {number} scale - Number of decimal places (default 2)
 * @param {string} outputField - The output field name (default same as input field)
 * @returns {Object} MongoDB aggregation pipeline stage
 */
const createCustomRoundStage = (fieldToRound, scale = 2, outputField = null) => {
    const multiplier = Math.pow(10, scale);
    const field = outputField || fieldToRound;
    
    return {
        '$addFields': {
            [field]: {
                '$divide': [
                    {
                        '$subtract': [
                            { '$add': [{ '$multiply': [`$${fieldToRound}`, multiplier] }, 0.5] },
                            { '$mod': [{ '$add': [{ '$multiply': [`$${fieldToRound}`, multiplier] }, 0.5] }, 1] }
                        ]
                    },
                    multiplier
                ]
            }
        }
    };
};

/**
 * Creates a conditional custom round stage
 * @param {string} fieldToRound - The field name to round
 * @param {Object} condition - MongoDB condition expression
 * @param {number} scale - Number of decimal places (default 2)
 * @param {string} outputField - The output field name (default same as input field)
 * @returns {Object} MongoDB aggregation pipeline stage
 */
const createConditionalRoundStage = (fieldToRound, condition, scale = 2, outputField = null) => {
    const multiplier = Math.pow(10, scale);
    const field = outputField || fieldToRound;
    
    return {
        '$addFields': {
            [field]: {
                '$cond': {
                    'if': condition,
                    'then': {
                        '$divide': [
                            {
                                '$subtract': [
                                    { '$add': [{ '$multiply': [`$${fieldToRound}`, multiplier] }, 0.5] },
                                    { '$mod': [{ '$add': [{ '$multiply': [`$${fieldToRound}`, multiplier] }, 0.5] }, 1] }
                                ]
                            },
                            multiplier
                        ]
                    },
                    'else': `$${fieldToRound}`
                }
            }
        }
    };
};

export {
    createCustomRoundStage,
    createConditionalRoundStage
}; 
