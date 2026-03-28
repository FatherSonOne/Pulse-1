#!/usr/bin/env python3
"""
Patch Messages.tsx to:
1. Import ConversationSidebar, MessageInputSection from new sub-components
2. Import shared constants from messageConstants
3. Replace sidebar JSX (lines 2760-3011) with <ConversationSidebar ... />
4. Replace input portal JSX (lines 4641-5205) with <MessageInputSection ... />
5. Remove/replace the constants that moved to messageConstants.ts
"""

import re

with open('src/components/Messages.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

total = len(lines)
print(f"Read {total} lines")

# ── 1. Insert new imports after the MessagesEndModals import (line 140) ──────
# Find the line with MessagesEndModals import
import_anchor = None
for i, line in enumerate(lines):
    if "MessagesEndModals" in line and "import" in line:
        import_anchor = i
        break

if import_anchor is None:
    print("ERROR: Could not find MessagesEndModals import")
    exit(1)

new_imports = [
    "import { ConversationSidebar } from './Messages/ConversationSidebar';\n",
    "import { MessageInputSection } from './Messages/MessageInputSection';\n",
    "import { MESSAGE_TEMPLATES as MSG_TEMPLATES_CONST, REACTION_CATEGORIES as REACTION_CATS_CONST, generateSmartTemplateText as genSmartTemplate } from './Messages/messageConstants';\n",
]

lines = lines[:import_anchor+1] + new_imports + lines[import_anchor+1:]
print(f"After import insertion: {len(lines)} lines")

# Reindex — find the actual lines now
def find_line(lines, search_text, start=0, end=None):
    end = end or len(lines)
    for i in range(start, end):
        if search_text in lines[i]:
            return i
    return None

# ── 2. Replace REACTION_CATEGORIES definition with import alias ──────────────
# Find: const REACTION_CATEGORIES = {
react_cat_start = find_line(lines, "const REACTION_CATEGORIES = {")
if react_cat_start is None:
    print("ERROR: Could not find REACTION_CATEGORIES definition")
    exit(1)

# Find the closing }; (5 lines later)
react_cat_end = react_cat_start + 1
while react_cat_end < len(lines) and "}" not in lines[react_cat_end]:
    react_cat_end += 1
react_cat_end += 1  # include the line with }

# Replace the block with a simple alias
lines[react_cat_start] = "const REACTION_CATEGORIES = REACTION_CATS_CONST;\n"
for i in range(react_cat_start + 1, react_cat_end):
    lines[i] = ""

print(f"Replaced REACTION_CATEGORIES at line {react_cat_start+1}")

# ── 3. Replace MESSAGE_TEMPLATES definition with import alias ────────────────
msg_tmpl_start = find_line(lines, "const MESSAGE_TEMPLATES = [")
if msg_tmpl_start is None:
    print("ERROR: Could not find MESSAGE_TEMPLATES definition")
    exit(1)

msg_tmpl_end = msg_tmpl_start + 1
brace_depth = 0
for i in range(msg_tmpl_start, len(lines)):
    if "[" in lines[i]:
        brace_depth += lines[i].count("[") - lines[i].count("]")
    if brace_depth <= 0 and i > msg_tmpl_start:
        msg_tmpl_end = i + 1
        break

lines[msg_tmpl_start] = "const MESSAGE_TEMPLATES = MSG_TEMPLATES_CONST;\n"
for i in range(msg_tmpl_start + 1, msg_tmpl_end):
    lines[i] = ""

print(f"Replaced MESSAGE_TEMPLATES at line {msg_tmpl_start+1}")

# ── 4. Replace generateSmartTemplateText with alias ─────────────────────────
gen_smart_start = find_line(lines, "const generateSmartTemplateText = (")
if gen_smart_start is None:
    print("ERROR: Could not find generateSmartTemplateText definition")
    exit(1)

gen_smart_end = gen_smart_start + 1
brace_depth = 0
for i in range(gen_smart_start, len(lines)):
    line = lines[i]
    brace_depth += line.count("{") - line.count("}")
    if brace_depth <= 0 and i > gen_smart_start:
        gen_smart_end = i + 1
        break

lines[gen_smart_start] = "const generateSmartTemplateText = genSmartTemplate;\n"
for i in range(gen_smart_start + 1, gen_smart_end):
    lines[i] = ""

print(f"Replaced generateSmartTemplateText at line {gen_smart_start+1}")

# ── 5. Replace sidebar JSX (find the comment marker) ────────────────────────
sidebar_comment = find_line(lines, "/* Sidebar (Threads) - Desktop: 30% width")
if sidebar_comment is None:
    print("ERROR: Could not find sidebar comment")
    exit(1)

# The sidebar starts one line after the comment
sidebar_start = sidebar_comment

# Find the closing </div> for the sidebar — it's the </div> matching the opening div at sidebar_start+1
# We look for the line with just "      </div>" after the known end of the list
# Known end pattern: the virtualConversations section ends with </div>, </div>, the empty state ends with </div>
# We find '      </div>' where depth returns to 0
depth = 0
sidebar_end = sidebar_start
for i in range(sidebar_start, len(lines)):
    line = lines[i]
    depth += line.count("<div") - line.count("</div")
    if depth <= 0 and i > sidebar_start:
        sidebar_end = i + 1
        break

print(f"Sidebar: lines {sidebar_start+1}-{sidebar_end} ({sidebar_end - sidebar_start} lines)")

conversation_sidebar_jsx = """\
      <ConversationSidebar
        sidebarRef={sidebarRef}
        mobileView={mobileView}
        setShowInviteModal={setShowInviteModal}
        setShowCellularSMS={setShowCellularSMS}
        setShowShortcuts={setShowShortcuts}
        setShowNewChatModal={setShowNewChatModal}
        threadFilter={threadFilter}
        setThreadFilter={setThreadFilter}
        showFilterDropdown={showFilterDropdown}
        setShowFilterDropdown={setShowFilterDropdown}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        handleSearch={handleSearch}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        searchResults={searchResults}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        setActiveThreadId={setActiveThreadId}
        setActivePulseConversation={setActivePulseConversation}
        setMobileView={setMobileView}
        setSearchQuery={setSearchQuery}
        setSearchResults={setSearchResults}
        threadListRef={threadListRef}
        pulseConversations={pulseConversations}
        conversationsTotalHeight={conversationsTotalHeight}
        virtualConversations={virtualConversations}
        activePulseConversation={activePulseConversation}
        setSelectedContactUserId={setSelectedContactUserId}
        setShowContactPanel={setShowContactPanel}
        handleSelectConversation={handleSelectConversation}
        messageEnhancements={messageEnhancements}
        handleDeletePulseConversation={handleDeletePulseConversation}
        threads={threads}
      />
"""

lines[sidebar_start:sidebar_end] = [conversation_sidebar_jsx]
print(f"Replaced sidebar with ConversationSidebar component")

# ── 6. Replace MessageInputPortal block ─────────────────────────────────────
portal_comment = find_line(lines, "/* Message Input Portal - Fixed at viewport bottom")
if portal_comment is None:
    print("ERROR: Could not find Message Input Portal comment")
    exit(1)

portal_start = portal_comment

# Find the closing }) for the conditional render
# The block is: {activeThread && !activePulseConversation && (<MessageInputPortal...>...</MessageInputPortal>)}
# Find end: the line with just "      )}" closing the conditional
depth = 0
in_jsx = False
portal_end = portal_start
for i in range(portal_start, len(lines)):
    line = lines[i]
    if "activeThread && !activePulseConversation" in line:
        in_jsx = True
    if in_jsx:
        depth += line.count("{") - line.count("}")
        if depth <= 0 and i > portal_start:
            portal_end = i + 1
            break

print(f"MessageInputPortal: lines {portal_start+1}-{portal_end} ({portal_end - portal_start} lines)")

message_input_jsx = """\
      <MessageInputSection
        activeThread={activeThread}
        activePulseConversation={activePulseConversation}
        sidebarWidth={sidebarRef.current?.offsetWidth || 0}
        isViewOnlyMode={isViewOnlyMode}
        isNonPulseThread={isNonPulseThread}
        canSendNativeSms={canSendNativeSms}
        activeContact={activeContact}
        contacts={contacts}
        setInviteTargetContact={setInviteTargetContact}
        setShowInviteToPulseModal={setShowInviteToPulseModal}
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        showEmojiPicker={showEmojiPicker}
        emojiPickerMessageId={emojiPickerMessageId}
        setShowEmojiPicker={setShowEmojiPicker}
        inputText={inputText}
        setInputText={setInputText}
        showAICoach={showAICoach}
        setShowAICoach={setShowAICoach}
        showSmartCompose={showSmartCompose}
        messageEnhancements={messageEnhancements}
        showQuickActionsBar={showQuickActionsBar}
        isRecording={isRecording}
        startRecording={startRecording}
        handleSmartReply={handleSmartReply}
        showAIMediator={showAIMediator}
        setShowAIMediator={setShowAIMediator}
        showQuickPhrases={showQuickPhrases}
        setShowQuickPhrases={setShowQuickPhrases}
        isProposalMode={isProposalMode}
        setIsProposalMode={setIsProposalMode}
        recordingDuration={recordingDuration}
        stopRecording={stopRecording}
        showVoiceExtractor={showVoiceExtractor}
        setShowVoiceExtractor={setShowVoiceExtractor}
        apiKey={apiKey}
        useIntentComposer={useIntentComposer}
        sendPulseMessage={sendPulseMessage}
        handleSendSms={handleSendSms}
        handleSend={handleSend}
        setActiveToolOverlay={setActiveToolOverlay}
        showAttachmentMenu={showAttachmentMenu}
        setShowAttachmentMenu={setShowAttachmentMenu}
        attachmentMenuRef={attachmentMenuRef}
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        handleImageUpload={handleImageUpload}
        handleVideoUpload={handleVideoUpload}
        handleAddLink={handleAddLink}
        loadingAI={loadingAI}
        isBotChat={isBotChat}
        setShowScheduleModal={setShowScheduleModal}
        scheduledMessages={scheduledMessages}
        activeThreadId={activeThreadId}
        showMeetingDeflector={showMeetingDeflector}
        setShowMeetingDeflector={setShowMeetingDeflector}
        useTemplate={useTemplate}
      />
"""

lines[portal_start:portal_end] = [message_input_jsx]
print(f"Replaced MessageInputPortal with MessageInputSection component")

# ── 7. Clean up consecutive blank lines ──────────────────────────────────────
cleaned = []
prev_blank = False
for line in lines:
    is_blank = line.strip() == ""
    if is_blank and prev_blank:
        continue
    cleaned.append(line)
    prev_blank = is_blank

print(f"Final line count: {len(cleaned)} (was {total})")

with open('src/components/Messages.tsx', 'w', encoding='utf-8') as f:
    f.writelines(cleaned)

print("Done! Messages.tsx patched successfully.")
