export const TECH_QUALITY_DND_TYPE = 'TECH_QUALITY_WIDGET';
export const TECH_QUALITY_WIDGETS_STORAGE_KEY = 'techQuality.widgets.v1';

export const TECH_QUALITY_WIDGETS = [
  { id: 'bugRate', label: 'Bug Rate' },
  { id: 'timeToResolution', label: 'Time to Resolution' },
  { id: 'defectEscapeRatio', label: 'Defect Escape Ratio' },
  { id: 'defectAcceptanceRatio', label: 'Defect Acceptance Ratio' },
];

export const TECH_QUALITY_TARGETS = {
  bugRate: '0.23',
  timeToResolution: '3.0',
  defectEscapeRatio: '1.0%',
  defectAcceptanceRatio: '80%',
};
