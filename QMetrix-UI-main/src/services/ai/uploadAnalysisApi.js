import axiosInstance from '../../axiosInstance';

const UPLOAD_ENDPOINT = '/api/vision/upload';

const buildFormData = ({ file, tenantId, dashboardType, sprintId }) => {
  const formData = new FormData();
  formData.append('screenshot', file);
  formData.append('tenantId', tenantId);

  if (dashboardType) {
    formData.append('dashboardType', dashboardType);
  }

  if (sprintId) {
    formData.append('sprintId', sprintId);
  }

  return formData;
};

export const uploadScreenshotAnalysis = async ({
  file,
  tenantId,
  dashboardType,
  sprintId,
  onUploadProgress,
} = {}) => {
  if (!file) {
    throw new Error('Please choose a screenshot to upload.');
  }

  if (!tenantId) {
    throw new Error('Missing tenant id for screenshot upload.');
  }

  const formData = buildFormData({ file, tenantId, dashboardType, sprintId });
  const response = await axiosInstance.post(UPLOAD_ENDPOINT, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });

  return response.data;
};

export default uploadScreenshotAnalysis;
