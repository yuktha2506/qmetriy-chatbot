import axiosInstance from '../../axiosInstance';

export const fetchDynamicInsights = (params) => axiosInstance.get('/ai/insights', { params });
