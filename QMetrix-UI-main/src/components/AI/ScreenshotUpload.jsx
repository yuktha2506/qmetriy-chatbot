import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CloudUpload, Image, RefreshCcw, Sparkles } from 'lucide-react';
import SummaryPanel from './SummaryPanel';
import UploadStatus from './UploadStatus';
import ErrorState from './ErrorState';
import {
  createScreenshotPreviewUrl,
  formatFileSize,
  getSupportedScreenshotTypesLabel,
  validateScreenshotFile,
} from '../../utils/ai/uploadValidation';
import {
  resetUploadState,
  setUploadError,
  setUploadedFile,
  submitScreenshotForAnalysis,
} from '../../store/ai/aiUploadSlice';

const STATUS_LABELS = {
  idle: 'Ready to upload',
  uploading: 'Uploading screenshot...',
  processing: 'Processing AI analysis...',
  completed: 'Analysis completed',
  failed: 'Analysis failed',
};

const ScreenshotUpload = () => {
  const dispatch = useDispatch();
  const { uploadedFile, analysisResult, uploadStatus, uploadProgress, uploadId, error } = useSelector(
    (state) => state.aiUpload,
  );
  const theme = useSelector((state) => state.theme.theme);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!uploadedFile) {
      setPreviewUrl('');
      return undefined;
    }

    const nextPreviewUrl = createScreenshotPreviewUrl(uploadedFile);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [uploadedFile]);

  const statusTone = useMemo(() => {
    if (uploadStatus === 'completed') {
      return 'text-[#1C8C4A]';
    }

    if (uploadStatus === 'failed') {
      return 'text-[#CC2018]';
    }

    if (uploadStatus === 'uploading' || uploadStatus === 'processing') {
      return 'text-[#066FD1]';
    }

    return theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]';
  }, [theme, uploadStatus]);

  const handleFile = (selectedFile) => {
    const validation = validateScreenshotFile(selectedFile);

    if (!validation.valid) {
      dispatch(resetUploadState());
      dispatch(setUploadError(validation.message));
      return;
    }

    dispatch(setUploadedFile(selectedFile));
    dispatch(submitScreenshotForAnalysis({ file: selectedFile }));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const handleReset = () => {
    dispatch(resetUploadState());
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const statusLabel = STATUS_LABELS[uploadStatus] || STATUS_LABELS.idle;
  const shouldShowSummary = Boolean(analysisResult) && uploadStatus === 'completed';

  return (
    <div className="space-y-5">
      <section
        className={`rounded-[28px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.08)] ${
          theme === 'dark' ? 'border-[#224F78] bg-[#08111B] text-white' : 'border-[#D1E2F0] bg-white text-[#0A2342]'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#48A7FF]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#48A7FF]">
              <Sparkles className="h-3.5 w-3.5" />
              Screenshot Upload
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Upload a sprint or dashboard screenshot</h2>
            <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
              Accepted formats: {getSupportedScreenshotTypesLabel()}
            </p>
          </div>
          <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${statusTone}`}>{statusLabel}</div>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className={`mt-5 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-5 py-8 text-center transition ${
            isDragging
              ? 'border-[#48A7FF] bg-[#48A7FF]/8'
              : theme === 'dark'
                ? 'border-[#224F78] bg-[#0D1621]'
                : 'border-[#D1E2F0] bg-[#F8FBFE]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <CloudUpload className="h-10 w-10 text-[#48A7FF]" />
          <p className="mt-4 text-lg font-semibold">Drag and drop a screenshot here</p>
          <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
            Or click to browse from your device
          </p>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#066FD1] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#054B8F]"
          >
            <Image className="h-4 w-4" />
            Select image
          </button>
        </div>

        {error && uploadStatus === 'failed' ? (
          <div className="mt-5">
            <ErrorState theme={theme} message={error} onRetry={uploadedFile ? () => dispatch(submitScreenshotForAnalysis({ file: uploadedFile })) : undefined} />
          </div>
        ) : null}

        {previewUrl ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div
              className={`overflow-hidden rounded-[24px] border ${
                theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-[#F8FBFE]'
              }`}
            >
              <img src={previewUrl} alt="Uploaded screenshot preview" className="h-full w-full object-cover" />
            </div>

            <div
              className={`rounded-[24px] border p-5 ${
                theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-white'
              }`}
            >
              <h3 className="text-lg font-semibold">Uploaded file</h3>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
                {uploadedFile?.name}
              </p>
              <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
                {formatFileSize(uploadedFile?.size || 0)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    uploadStatus === 'completed'
                      ? 'bg-[#1C8C4A]/15 text-[#7EE2A1]'
                      : uploadStatus === 'failed'
                        ? 'bg-[#CC2018]/15 text-[#FFB0AA]'
                        : 'bg-[#48A7FF]/15 text-[#48A7FF]'
                  }`}
                >
                  {statusLabel}
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    theme === 'dark'
                      ? 'bg-[#173A5A] text-white hover:bg-[#224F78]'
                      : 'bg-[#EFF8FE] text-[#0A2342] hover:bg-[#D9EDF8]'
                  }`}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'completed' ? (
        <UploadStatus
          theme={theme}
          status={uploadStatus}
          progress={uploadProgress}
          uploadId={uploadId}
          message={
            uploadStatus === 'uploading'
              ? 'Sending the screenshot to the backend.'
              : uploadStatus === 'processing'
                ? 'The AI service is preparing the summary.'
                : 'The summary is ready below.'
          }
        />
      ) : null}

      {shouldShowSummary ? (
        <SummaryPanel
          analysis={analysisResult}
          file={uploadedFile}
          uploadId={uploadId}
          status={uploadStatus}
          error={error}
          onRetry={() => uploadedFile && dispatch(submitScreenshotForAnalysis({ file: uploadedFile }))}
        />
      ) : null}
    </div>
  );
};

export default ScreenshotUpload;
