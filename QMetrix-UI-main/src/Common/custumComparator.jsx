/**
 * Smart comparator for alphanumeric IDs like "QM-67" or "PR-123".
 * Sorts by prefix first, then numeric suffix.
 */
export const customComparator = (valueA, valueB) => {
    const extractParts = (val) => {
      const match = String(val).match(/^([a-zA-Z-]+)?(\d+)$/);
      if (match) {
        return {
          prefix: match[1] || '',
          number: parseInt(match[2], 10),
        };
      }
      return { prefix: '', number: Number.NaN };
    };
  
    const a = extractParts(valueA);
    const b = extractParts(valueB);
  
    if (a.prefix !== b.prefix) {
      return a.prefix.localeCompare(b.prefix, 'en-US', {
        sensitivity: 'base',
        ignorePunctuation: true,
      });
    }
  
    // If prefix is the same, sort by the numeric part
    return a.number - b.number;
  };
  
