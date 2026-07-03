export const ALLOWED_SCREENSHOT_MIME_TYPES = ['image/png', 'image/jpeg'];
export const ALLOWED_SCREENSHOT_EXTENSIONS = ['png', 'jpg', 'jpeg'];

export const MAX_SCREENSHOT_FILE_SIZE_MB = 10;
export const MAX_SCREENSHOT_FILE_SIZE_BYTES = MAX_SCREENSHOT_FILE_SIZE_MB * 1024 * 1024;

const TYPE_ERROR_MESSAGE = 'Only PNG/JPG images are allowed';
const SIZE_ERROR_MESSAGE = 'File size exceeds allowed limit';

const getFileExtension = (file) => {
  const fileName = String(file?.name || '').toLowerCase();
  const extension = fileName.split('.').pop();
  return extension && extension !== fileName ? extension : '';
};

export const formatFileSize = (bytes = 0) => {
  if (!bytes || Number.isNaN(bytes)) {
    return '0 KB';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getSupportedScreenshotTypesLabel = () => 'PNG, JPG, or JPEG';

export const validateFileType = (file) => {
  if (!file) {
    return { valid: false, message: 'Please choose a screenshot to upload' };
  }

  const mimeType = String(file.type || '').toLowerCase();
  const extension = getFileExtension(file);
  const isAllowed =
    ALLOWED_SCREENSHOT_MIME_TYPES.includes(mimeType) || ALLOWED_SCREENSHOT_EXTENSIONS.includes(extension);

  if (!isAllowed) {
    return { valid: false, message: TYPE_ERROR_MESSAGE };
  }

  return { valid: true, message: '' };
};

export const validateFileSize = (file) => {
  if (!file) {
    return { valid: false, message: 'Please choose a screenshot to upload' };
  }

  if (Number(file.size || 0) > MAX_SCREENSHOT_FILE_SIZE_BYTES) {
    return { valid: false, message: SIZE_ERROR_MESSAGE };
  }

  return { valid: true, message: '' };
};

export const formatUploadError = (error) => {
  if (!error) {
    return 'Unable to upload the screenshot right now.';
  }

  if (typeof error === 'string') {
    return error;
  }

  return error.message || error.error || 'Unable to upload the screenshot right now.';
};

export const validateScreenshotFile = (file) => {
  const typeCheck = validateFileType(file);
  if (!typeCheck.valid) {
    return typeCheck;
  }

  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    return sizeCheck;
  }

  return { valid: true, message: '' };
};

export const createScreenshotPreviewUrl = (file) => (file ? URL.createObjectURL(file) : '');
