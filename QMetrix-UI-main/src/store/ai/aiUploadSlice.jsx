import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { uploadScreenshotAnalysis } from '../../services/ai/uploadAnalysisApi';
import { formatUploadError } from '../../utils/ai/uploadValidation';

const initialState = {
  uploadedFile: null,
  uploadStatus: 'idle',
  uploadProgress: 0,
  uploadId: null,
  analysisResult: null,
  error: null,
};

const normalizeUploadInput = (input) => {
  if (!input) {
    return {};
  }

  if (typeof File !== 'undefined' && input instanceof File) {
    return { file: input };
  }

  if (typeof input === 'object') {
    return input;
  }

  return {};
};

const normalizeAnalysisResult = (payload) => {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    return { summary: payload };
  }

  const hasAnalysisFields =
    payload.analysisResult ||
    payload.analysis ||
    payload.data ||
    payload.result ||
    payload.summary ||
    payload.health ||
    payload.risks ||
    payload.blockers ||
    payload.qaRisks ||
    payload.velocityInsights ||
    payload.recommendations;

  if (!hasAnalysisFields) {
    return null;
  }

  return payload.analysisResult || payload.analysis || payload.data || payload.result || payload;
};

export const submitScreenshotForAnalysis = createAsyncThunk(
  'aiUpload/submitScreenshotForAnalysis',
  async (input, { dispatch, rejectWithValue }) => {
    const { file, dashboardType, sprintId, tenantId } = normalizeUploadInput(input);

    if (!file) {
      return rejectWithValue('Please choose a screenshot to upload');
    }

    try {
      dispatch(setUploadStatus('uploading'));
      dispatch(setUploadProgress(0));

      const resolvedTenantId =
        tenantId || sessionStorage.getItem('tenantId') || sessionStorage.getItem('companyId');
      const resolvedSprintId = sprintId || sessionStorage.getItem('sprintId') || undefined;

      const response = await uploadScreenshotAnalysis({
        file,
        tenantId: resolvedTenantId,
        dashboardType,
        sprintId: resolvedSprintId,
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) {
            return;
          }

          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          dispatch(setUploadProgress(progress));
        },
      });

      const uploadId = response?.uploadId || response?.data?.uploadId || null;
      const analysisResult = normalizeAnalysisResult(response);
      const nextStatus = analysisResult ? 'completed' : 'processing';

      return {
        uploadId,
        analysisResult,
        uploadProgress: 100,
        status: nextStatus,
      };
    } catch (error) {
      return rejectWithValue(formatUploadError(error?.response?.data?.message || error));
    }
  },
);

const aiUploadSlice = createSlice({
  name: 'aiUpload',
  initialState,
  reducers: {
    setUploadedFile: (state, action) => {
      state.uploadedFile = action.payload || null;
      state.uploadStatus = 'idle';
      state.uploadProgress = 0;
      state.uploadId = null;
      state.analysisResult = null;
      state.error = null;
    },
    setUploadStatus: (state, action) => {
      state.uploadStatus = action.payload;
    },
    setUploadProgress: (state, action) => {
      const nextProgress = Number(action.payload || 0);
      state.uploadProgress = Number.isNaN(nextProgress) ? 0 : Math.min(Math.max(nextProgress, 0), 100);
    },
    setUploadId: (state, action) => {
      state.uploadId = action.payload || null;
    },
    setAnalysisResult: (state, action) => {
      state.analysisResult = action.payload || null;
      if (action.payload) {
        state.uploadStatus = 'completed';
        state.error = null;
      }
    },
    setUploadError: (state, action) => {
      state.error = action.payload || null;
      state.uploadStatus = action.payload ? 'failed' : state.uploadStatus;
    },
    resetUploadState: (state) => {
      state.uploadedFile = null;
      state.uploadStatus = 'idle';
      state.uploadProgress = 0;
      state.uploadId = null;
      state.analysisResult = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitScreenshotForAnalysis.pending, (state) => {
        state.error = null;
        state.uploadId = null;
        state.analysisResult = null;
      })
      .addCase(submitScreenshotForAnalysis.fulfilled, (state, action) => {
        state.uploadId = action.payload.uploadId || null;
        state.analysisResult = action.payload.analysisResult || null;
        state.uploadProgress = action.payload.uploadProgress ?? state.uploadProgress;
        state.uploadStatus = action.payload.status || (action.payload.analysisResult ? 'completed' : 'processing');
        state.error = null;
      })
      .addCase(submitScreenshotForAnalysis.rejected, (state, action) => {
        state.uploadStatus = 'failed';
        state.error = action.payload || action.error?.message || 'Unable to upload the screenshot right now.';
      });
  },
});

export const {
  setUploadedFile,
  setUploadStatus,
  setUploadProgress,
  setUploadId,
  setAnalysisResult,
  setUploadError,
  resetUploadState,
} = aiUploadSlice.actions;

export default aiUploadSlice.reducer;
