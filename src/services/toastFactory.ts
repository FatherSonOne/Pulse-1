import React from 'react';
import toast from 'react-hot-toast';
import i18n from '../i18n';

const buttonBase =
  'min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors';

export function showScopeLossToast(onReconnect: () => void): void {
  toast.custom(
    (toastInstance) =>
      React.createElement(
        'div',
        {
          role: 'alert',
          'aria-live': 'assertive',
          className: 'mx-3 w-[min(92vw,420px)] rounded-lg p-4 shadow-lg',
          style: {
            background: 'var(--pulse-tone-warning-soft)',
            border: '1px solid var(--pulse-tone-warning)',
            color: 'var(--pulse-ink)',
          },
        },
        React.createElement('strong', { className: 'block text-sm' }, i18n.t('contacts.scopeLossToast.title')),
        React.createElement(
          'p',
          { className: 'mt-1 text-sm', style: { color: 'var(--pulse-ink-2)' } },
          i18n.t('contacts.scopeLossToast.body')
        ),
        React.createElement(
          'div',
          { className: 'flex gap-2 mt-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: `${buttonBase} text-white`,
              style: { background: 'var(--pulse-rose)' },
              onClick: () => {
                onReconnect();
                toast.dismiss(toastInstance.id);
              },
            },
            i18n.t('contacts.scopeLossToast.cta')
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: buttonBase,
              style: {
                border: '1px solid var(--pulse-border)',
                color: 'var(--pulse-ink-2)',
                background: 'var(--pulse-surface)',
              },
              onClick: () => toast.dismiss(toastInstance.id),
            },
            i18n.t('contacts.scopeLossToast.dismiss')
          )
        )
      ),
    { duration: 6000, position: 'top-center' }
  );
}

export function showImportErrorToast(message: string): void {
  toast.custom(
    () =>
      React.createElement(
        'div',
        {
          role: 'alert',
          'aria-live': 'assertive',
          className: 'mx-3 w-[min(92vw,420px)] rounded-lg p-4 shadow-lg',
          style: {
            background: 'var(--pulse-tone-overdue-soft)',
            border: '1px solid var(--pulse-tone-overdue)',
            color: 'var(--pulse-ink)',
          },
        },
        React.createElement('p', { className: 'text-sm font-semibold' }, message)
      ),
    { duration: 5000, position: 'top-center' }
  );
}
