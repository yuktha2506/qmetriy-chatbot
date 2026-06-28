import { createElement } from 'react';

export const standUpChartSuspenseFallback = createElement('div', {
  className: 'h-[140px] w-full rounded bg-[#F0F4F8] dark:bg-[#1a2838] animate-pulse',
  'aria-hidden': true,
});
