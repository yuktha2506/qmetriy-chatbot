import PropTypes from 'prop-types';
import { CheckCircle2, LoaderCircle, UploadCloud, XCircle } from 'lucide-react';

const STATUS_COPY = {
  uploading: {
    label: 'Uploading screenshot...',
    description: 'Your image is being sent to the AI service.',
    icon: LoaderCircle,
  },
  processing: {
    label: 'Processing AI analysis...',
    description: 'The backend is preparing the summary output.',
    icon: UploadCloud,
  },
  completed: {
    label: 'Analysis completed',
    description: 'The summary is ready to review.',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Analysis failed',
    description: 'Please review the message below and try again.',
    icon: XCircle,
  },
};

const UploadStatus = ({ status = 'idle', progress = 0, message = '', uploadId = '', theme = 'dark' }) => {
  if (!STATUS_COPY[status]) {
    return null;
  }

  const config = STATUS_COPY[status];
  const Icon = config.icon;
  const progressValue = Math.min(Math.max(Number(progress || 0), 0), 100);

  return (
    <div
      className={`rounded-[22px] border p-4 transition-all duration-200 ${
        theme === 'dark'
          ? 'border-[#224F78] bg-[#0D1621] text-white'
          : 'border-[#D1E2F0] bg-[#F8FBFE] text-[#0A2342]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full ${
            status === 'failed'
              ? 'bg-[#7A1E33]/15 text-[#FF9FB2]'
              : status === 'completed'
                ? 'bg-[#1C8C4A]/15 text-[#7EE2A1]'
                : 'bg-[#48A7FF]/15 text-[#48A7FF]'
          }`}
        >
          <Icon className={`h-5 w-5 ${status === 'uploading' ? 'animate-spin' : ''}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{config.label}</p>
          <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
            {message || config.description}
          </p>

          {status === 'uploading' ? (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3 text-xs font-medium">
                <span>Upload progress</span>
                <span>{progressValue}%</span>
              </div>
              <div
                className={`mt-2 h-2 overflow-hidden rounded-full ${
                  theme === 'dark' ? 'bg-[#173A5A]' : 'bg-[#E2EEF8]'
                }`}
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#48A7FF] to-[#066FD1] transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>
          ) : null}

          {uploadId ? (
            <p className={`mt-3 text-xs ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
              Upload ID: <span className="font-semibold">{uploadId}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

UploadStatus.propTypes = {
  status: PropTypes.oneOf(['idle', 'uploading', 'processing', 'completed', 'failed']),
  progress: PropTypes.number,
  message: PropTypes.string,
  uploadId: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
};

export default UploadStatus;
