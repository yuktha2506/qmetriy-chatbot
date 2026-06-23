import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { MessageCircleMore } from 'lucide-react';
import ChatInput from './ChatInput';

const arrayify = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
};

const buildAnalysisResponse = (question, analysis) => {
  const trimmedQuestion = String(question || '').trim().toLowerCase();
  const summary = analysis?.summary || analysis?.overview || 'the screenshot analysis';
  const health = analysis?.health || analysis?.sprintHealth || 'unknown';
  const blockers = arrayify(analysis?.blockers || analysis?.blockerIssues || analysis?.risks);
  const qaRisks = arrayify(analysis?.qaRisks || analysis?.qualityRisks || analysis?.testRisks);
  const velocityInsights = arrayify(analysis?.velocityInsights || analysis?.velocity || analysis?.highlights);
  const recommendations = arrayify(analysis?.recommendations || analysis?.suggestions);

  if (trimmedQuestion.includes('block')) {
    return blockers.length
      ? `The main blockers are ${blockers.join('; ')}.`
      : 'No blockers were highlighted in the current summary.';
  }

  if (trimmedQuestion.includes('qa') || trimmedQuestion.includes('quality') || trimmedQuestion.includes('risk')) {
    return qaRisks.length
      ? `QA and quality risks to watch: ${qaRisks.join('; ')}.`
      : 'The summary does not highlight a separate QA risk, but the overall health should still be monitored.';
  }

  if (
    trimmedQuestion.includes('velocity') ||
    trimmedQuestion.includes('burn') ||
    trimmedQuestion.includes('trend') ||
    trimmedQuestion.includes('delivery')
  ) {
    return velocityInsights.length
      ? `Velocity notes: ${velocityInsights.join('; ')}.`
      : `The current sprint health is ${health.toLowerCase()}, with ${summary.toLowerCase()}.`;
  }

  if (trimmedQuestion.includes('recommend') || trimmedQuestion.includes('next step')) {
    return recommendations.length
      ? `Recommended next steps: ${recommendations.join('; ')}.`
      : 'A good next step is to review the blockers and confirm ownership before the next checkpoint.';
  }

  if (trimmedQuestion.includes('health') || trimmedQuestion.includes('summary') || trimmedQuestion.includes('sprint')) {
    return `Sprint health is currently ${health.toLowerCase()}, and the summary points to ${summary.toLowerCase()}.`;
  }

  return `Based on the screenshot summary, ${summary.toLowerCase()}.`;
};

const FollowUpSection = ({ analysis, theme = 'dark' }) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setMessages([]);
    setIsTyping(false);
  }, [analysis?.uploadId, analysis?.summary, analysis?.id]);

  const hasAnalysis = Boolean(analysis);

  const headingTone = useMemo(
    () => (theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'),
    [theme],
  );

  const handleSend = async (question) => {
    const trimmedQuestion = String(question || '').trim();
    if (!trimmedQuestion || !hasAnalysis) {
      return;
    }

    const userMessage = {
      id: `followup-user-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion,
    };

    setMessages((current) => [...current, userMessage]);
    setIsTyping(true);

    window.setTimeout(() => {
      const assistantMessage = {
        id: `followup-assistant-${Date.now()}`,
        role: 'assistant',
        content: buildAnalysisResponse(trimmedQuestion, analysis),
      };

      setMessages((current) => [...current, assistantMessage]);
      setIsTyping(false);
    }, 350);
  };

  return (
    <section
      className={`rounded-[24px] border p-4 ${
        theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-[#F8FBFE]'
      }`}
    >
      <div className="flex items-center gap-2">
        <MessageCircleMore className="h-4 w-4 text-[#48A7FF]" />
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em]">Follow-up</h4>
      </div>
      <p className={`mt-2 text-sm ${headingTone}`}>
        Ask a question about the summary and keep the conversation inside the chatbot.
      </p>

      <div className="mt-4 space-y-3">
        {messages.length ? (
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  item.role === 'user'
                    ? theme === 'dark'
                      ? 'ml-10 bg-[#48A7FF] text-[#0A2342]'
                      : 'ml-10 bg-[#066FD1] text-white'
                    : theme === 'dark'
                      ? 'mr-10 border border-[#224F78] bg-[#173A5A] text-white'
                      : 'mr-10 border border-[#D1E2F0] bg-white text-[#0A2342]'
                }`}
              >
                {item.content}
              </div>
            ))}
          </div>
        ) : null}

        {isTyping ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              theme === 'dark'
                ? 'border-[#224F78] bg-[#173A5A] text-[#D9E4F1]'
                : 'border-[#D1E2F0] bg-white text-[#0A2342]'
            }`}
          >
            Thinking about the screenshot...
          </div>
        ) : null}

        <ChatInput
          onSend={handleSend}
          disabled={!hasAnalysis || isTyping}
          placeholder={hasAnalysis ? 'Ask a follow-up question...' : 'Upload a screenshot to unlock follow-up questions'}
          theme={theme}
        />
      </div>
    </section>
  );
};

FollowUpSection.propTypes = {
  analysis: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  theme: PropTypes.oneOf(['light', 'dark']),
};

export default FollowUpSection;
