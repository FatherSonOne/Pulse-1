import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ContactsEmptyStateProps {
  onConnectClick: () => void;
  onAddManualClick: () => void;
  variant?: 'today' | 'people' | 'circles';
}

export const ContactsEmptyState: React.FC<ContactsEmptyStateProps> = ({
  onConnectClick,
  onAddManualClick,
}) => {
  const { t } = useTranslation();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="contacts-empty-headline"
      className="h-full w-full flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--pulse-canvas)' }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-[480px] w-full flex flex-col items-center text-center"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--pulse-rose-soft)' }}
        >
          <UsersRound className="w-10 h-10" style={{ color: 'var(--pulse-rose)' }} aria-hidden="true" />
        </div>

        <h2
          id="contacts-empty-headline"
          className="text-2xl md:text-3xl font-semibold mb-3"
          style={{ color: 'var(--pulse-ink)' }}
        >
          {t('contacts.empty.headline')}
        </h2>
        <p
          id="contacts-empty-body"
          className="text-sm md:text-base leading-7 mb-8"
          style={{ color: 'var(--pulse-ink-2)' }}
        >
          {t('contacts.empty.body')}
        </p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-3 w-full">
          <button
            ref={primaryRef}
            type="button"
            aria-describedby="contacts-empty-body"
            onClick={onConnectClick}
            className="w-full md:w-auto min-h-[44px] px-5 py-3 rounded-lg font-semibold text-white transition-colors"
            style={{ background: 'var(--pulse-rose)' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--pulse-rose-deep)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'var(--pulse-rose)';
            }}
          >
            {t('contacts.empty.cta_primary')}
          </button>
          <button
            type="button"
            aria-describedby="contacts-empty-body"
            onClick={onAddManualClick}
            className="w-full md:w-auto min-h-[44px] px-5 py-3 rounded-lg font-semibold transition-colors"
            style={{ color: 'var(--pulse-ink-2)' }}
          >
            {t('contacts.empty.cta_secondary')}
          </button>
        </div>
      </motion.div>
    </section>
  );
};

export default ContactsEmptyState;
