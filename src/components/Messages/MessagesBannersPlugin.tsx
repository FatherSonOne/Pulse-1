/**
 * MessagesBannersPlugin
 *
 * Phase 5d.2 — top-of-thread banners for `MessagesSplitView`.
 *
 * Migration target for the conditional banners currently rendered
 * inline above the input in legacy `MessageInputSection.tsx` (lines
 * ~122-171). The legacy code path keeps working unchanged; this
 * plugin is what `MessagesSplitView` mounts in `renderTopBanner`
 * once Phase 5e flips production.
 *
 * Banners:
 *   1. View-only-mode banner — non-Pulse contact viewed on a desktop
 *      where SMS isn't possible. Suggests opening the app on mobile
 *      and offers an "Invite to Pulse" CTA.
 *   2. SMS-mode hint — non-Pulse contact viewed on a native (Capacitor)
 *      device where SMS sending IS available. Tells the user their
 *      message will go via carrier SMS, with an opt-in "Invite to
 *      Pulse" CTA.
 *
 * Both banners are decoupled from the modal layer via the
 * `onInviteContact` callback. In the new architecture the host wires
 * this to `useMessagesModals().openInviteToPulse(contact)`; in the
 * legacy path it's wired directly to setShowInviteToPulseModal.
 */

import React from 'react';
import { MessageSquare, Rocket, Smartphone } from 'lucide-react';
import type { Contact } from '../../types';

interface MessagesBannersPluginProps {
  /** True when viewing a non-Pulse contact on a platform where SMS
   *  isn't available (typically desktop). The banner nudges the user
   *  to either open the app on mobile or invite the contact. */
  isViewOnlyMode: boolean;

  /** True when the active thread is non-Pulse AND the platform supports
   *  carrier SMS (Capacitor with messaging permissions). The banner
   *  reminds the user that the message goes via carrier SMS. */
  isNonPulseThread: boolean;
  canSendNativeSms: boolean;

  /** Active contact — used in the banner copy ("Messages to {name}…"). */
  activeContact: Contact | null;

  /** Triggered when the user taps the "Invite to Pulse" CTA in either
   *  banner. Host typically calls `openInviteToPulse(contact)` from
   *  `useMessagesModals()`. */
  onInviteContact: (contact: Contact) => void;
}

export const MessagesBannersPlugin: React.FC<MessagesBannersPluginProps> = ({
  isViewOnlyMode,
  isNonPulseThread,
  canSendNativeSms,
  activeContact,
  onInviteContact,
}) => {
  const handleInviteClick = () => {
    if (activeContact) onInviteContact(activeContact);
  };

  return (
    <>
      {isViewOnlyMode && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0">
              <Smartphone className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1">
                Send from your phone
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                {activeContact?.name || 'This contact'} isn't on Pulse yet. Open the app on your mobile device to send SMS messages.
              </p>
              <button
                type="button"
                onClick={handleInviteClick}
                disabled={!activeContact}
                className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Rocket /> Invite to Pulse for free messaging
              </button>
            </div>
          </div>
        </div>
      )}

      {isNonPulseThread && canSendNativeSms && (
        <div className="mb-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center gap-2 text-xs">
          <MessageSquare className="text-zinc-500 dark:text-zinc-400" />
          <span className="text-zinc-700 dark:text-zinc-300">
            Messages to {activeContact?.name || 'this contact'} will be sent as SMS via your carrier
          </span>
          <button
            type="button"
            onClick={handleInviteClick}
            disabled={!activeContact}
            className="ml-auto text-rose-600 dark:text-rose-400 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Invite to Pulse
          </button>
        </div>
      )}
    </>
  );
};

export default MessagesBannersPlugin;
