import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { AlertTriangle, BrainCircuit, CircleCheckBig, Gauge, ListTodo, ShieldAlert } from 'lucide-react';
import { useSelector } from 'react-redux';
import ErrorState from './ErrorState';
import FollowUpSection from './FollowUpSection';
import { formatFileSize } from '../../utils/ai/uploadValidation';

const toArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
};

const toText = (value, fallback) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' • ');
  }

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return String(value);
};

const fieldFromAnalysis = (analysis, keys, fallback = '') => {
  for (const key of keys) {
    if (analysis?.[key] !== undefined && analysis?.[key] !== null && analysis?.[key] !== '') {
      return analysis[key];
    }
  }

  return fallback;
};

const SummaryPanel = ({ analysis, file, uploadId, status, error, onRetry }) => {
  const theme = useSelector((state) => state.theme.theme);

  const summaryData = useMemo(() => {
    if (!analysis) {
      return null;
    }

    const summary = fieldFromAnalysis(analysis, ['summary', 'overview', 'resultSummary', 'insightSummary'], '');
    const health = fieldFromAnalysis(analysis, ['health', 'sprintHealth', 'status', 'riskLevel'], 'Pending');
    const blockers = toArray(
      fieldFromAnalysis(analysis, ['blockers', 'blockerIssues', 'issues', 'risks', 'riskIndicators'], []),
    );
    const qaRisks = toArray(fieldFromAnalysis(analysis, ['qaRisks', 'qualityRisks', 'testRisks'], []));
    const velocity = toArray(
      fieldFromAnalysis(analysis, ['velocityInsights', 'velocity', 'deliveryInsights', 'highlights'], []),
    );
    const recommendations = toArray(
      fieldFromAnalysis(analysis, ['recommendations', 'suggestions', 'nextSteps'], []),
    );

    return {
      summary: toText(summary, 'Analysis is being prepared.'),
      health: toText(health, 'Pending'),
      blockers,
      qaRisks,
      velocity,
      recommendations,
      raw: analysis,
    };
  }, [analysis]);

  if (status === 'failed') {
    return (
      <ErrorState
        theme={theme}
        message={error || 'Something went wrong while analyzing the screenshot.'}
        onRetry={onRetry}
      />
    );
  }

  if (!summaryData) {
    return null;
  }

  const cards = [
    {
      label: 'Sprint health',
      value: summaryData.health,
      icon: CircleCheckBig,
    },
    {
      label: 'Risk indicators',
      value: summaryData.blockers.length ? summaryData.blockers.join(' • ') : 'No major risk signals reported.',
      icon: ShieldAlert,
    },
    {
      label: 'Velocity insights',
      value: summaryData.velocity.length ? summaryData.velocity.join(' • ') : 'No velocity trend returned.',
      icon: Gauge,
    },
    {
      label: 'Blockers',
      value: summaryData.blockers.length ? summaryData.blockers.join(' • ') : 'No blockers identified.',
      icon: AlertTriangle,
    },
    {
      label: 'QA risks',
      value: summaryData.qaRisks.length ? summaryData.qaRisks.join(' • ') : 'No QA risks highlighted.',
      icon: ListTodo,
    },
    {
      label: 'Recommendations',
      value: summaryData.recommendations.length
        ? summaryData.recommendations.join(' • ')
        : 'No recommendations returned yet.',
      icon: BrainCircuit,
    },
  ];

  return (
    <section
      className={`overflow-hidden rounded-[28px] border shadow-[0_18px_50px_rgba(0,0,0,0.12)] ${
        theme === 'dark' ? 'border-[#224F78] bg-[#08111B] text-white' : 'border-[#D1E2F0] bg-white text-[#0A2342]'
      }`}
    >
      <div
        className={`flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 ${
          theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-[#F8FBFE]'
        }`}
      >
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#48A7FF]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#48A7FF]">
            <BrainCircuit className="h-3.5 w-3.5" />
            Screenshot Summary
          </p>
          <h3 className="mt-3 text-2xl font-semibold">AI analysis ready</h3>
          <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
            {file ? `${file.name} • ${formatFileSize(file.size)}` : 'Uploaded screenshot'}
          </p>
        </div>
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            summaryData.health.toLowerCase().includes('risk')
              ? 'bg-[#7A1E33]/15 text-[#FF9FB2]'
              : theme === 'dark'
                ? 'bg-[#173A5A] text-white'
                : 'bg-[#EFF8FE] text-[#0A2342]'
          }`}
        >
          {summaryData.health}
        </div>
      </div>

      <div className="max-h-[58vh] overflow-y-auto">
        <div className="grid gap-3 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.label}
                className={`rounded-2xl border p-4 ${
                  theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-[#F8FBFE]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full ${
                      theme === 'dark' ? 'bg-[#173A5A] text-[#7CC1FF]' : 'bg-[#EAF4FF] text-[#066FD1]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                        theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'
                      }`}
                    >
                      {card.label}
                    </p>
                    <p className="mt-2 text-sm leading-6">{card.value}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[1.15fr_0.85fr]">
          <article
            className={`rounded-[24px] border p-5 ${
              theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-white'
            }`}
          >
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#48A7FF]">Summary</h4>
            <p className="mt-4 text-base leading-7">{summaryData.summary}</p>

            {uploadId ? (
              <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
                Upload ID: <span className="font-semibold">{uploadId}</span>
              </p>
            ) : null}
          </article>

          <article
            className={`rounded-[24px] border p-5 ${
              theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-white'
            }`}
          >
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#48A7FF]">Highlights</h4>
            <div className="mt-4 space-y-3">
              {(summaryData.velocity.length ? summaryData.velocity : summaryData.recommendations).slice(0, 4).map((item) => (
                <div
                  key={item}
                  className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                    theme === 'dark'
                      ? 'border-[#224F78] bg-[#173A5A] text-[#D9E4F1]'
                      : 'border-[#D1E2F0] bg-[#F8FBFE] text-[#0A2342]'
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="px-5 pb-5">
          <FollowUpSection analysis={summaryData.raw} theme={theme} />
        </div>
      </div>
    </section>
  );
};

SummaryPanel.propTypes = {
  analysis: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  file: PropTypes.shape({
    name: PropTypes.string,
    size: PropTypes.number,
  }),
  uploadId: PropTypes.string,
  status: PropTypes.oneOf(['idle', 'uploading', 'processing', 'completed', 'failed']),
  error: PropTypes.string,
  onRetry: PropTypes.func,
};

export default SummaryPanel;
