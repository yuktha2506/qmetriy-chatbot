export const formatInsightCard = (insight = {}) => ({
  title: insight.title || '',
  summary: insight.summary || '',
});
