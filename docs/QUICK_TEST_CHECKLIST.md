# Quick Test Checklist - Phase 5

**Purpose**: Fast verification that all integrated features work
**Time**: 15-30 minutes
**Date**: January 19, 2026

---

## Pre-Flight Check ✈️

Before testing:
- [ ] Database migration applied: `npx supabase db push --include-all`
- [ ] Dev server running: `npm run dev`
- [ ] Test user logged in
- [ ] Browser extensions loaded (Chrome/Firefox)

---

## 1. Browser Extension (5 minutes)

### Chrome
- [ ] Load unpacked extension from `f:\pulse1\browser-extension`
- [ ] Extension icon appears in toolbar
- [ ] Click extension → Sign in works
- [ ] Press Ctrl+Shift+P → Quick capture popup appears
- [ ] Save test content → Appears in War Room

### Firefox (optional)
- [ ] Load temporary extension
- [ ] Same tests as Chrome

**Quick Test**: Capture this page with Ctrl+Shift+P and verify it saves.

---

## 2. Email Template System (5 minutes)

### Create Template
- [ ] Open Email Templates Modal
- [ ] Click "Create New Template"
- [ ] Fill in:
  ```
  Name: Test Template
  Subject: Hello {{firstName}}
  Body: Hi {{firstName}}, welcome to {{company}}!
  Category: Sales
  ```
- [ ] Save → Template appears in list
- [ ] Variables extracted: [firstName, company]

### Use Template
- [ ] Select template
- [ ] Click "Use Template"
- [ ] Variables replaced with real data
- [ ] Subject and body filled in composer

**Quick Test**: Create one template and use it in an email.

---

## 3. CRM Integration Wizard (5 minutes)

**Note**: Requires OAuth credentials in `.env.local`

### Setup Wizard
- [ ] Settings → CRM Integrations
- [ ] Click "Connect CRM"
- [ ] Platform selection shows: HubSpot, Salesforce, Pipedrive, Zoho
- [ ] Select HubSpot
- [ ] OAuth configuration step appears
- [ ] (Optional) Complete OAuth if credentials available

### Sync Status Panel
- [ ] Dashboard → CRM Sync Status widget
- [ ] Shows connected CRM (if OAuth completed)
- [ ] Last sync timestamp
- [ ] Manual sync button works

**Quick Test**: Open wizard and verify all steps appear correctly.

---

## 4. Database Verification (5 minutes)

### Supabase Dashboard
- [ ] Open Supabase → Table Editor

### Check Tables Exist
- [ ] `knowledge_docs` table
- [ ] `project_docs` table
- [ ] `email_templates` table
- [ ] `template_categories` table
- [ ] `crm_integrations` table
- [ ] `crm_sync_logs` table

### Check Data
- [ ] `knowledge_docs` has captured content (from browser extension test)
- [ ] `email_templates` has created template
- [ ] All entries have correct `user_id`

---

## 5. Cross-Feature Smoke Test (5 minutes)

### Integration Flow
1. [ ] Capture webpage with browser extension → Content in War Room ✓
2. [ ] Create email template with variables → Template saved ✓
3. [ ] Use template in email → Variables replaced ✓
4. [ ] (If CRM connected) Sync CRM → Contacts available ✓

---

## Critical Issues Found

Use this section to note any blocking issues:

### Browser Extension
- [ ] ❌ Issue: ___________________________
- [ ] ✅ No critical issues

### Email Templates
- [ ] ❌ Issue: ___________________________
- [ ] ✅ No critical issues

### CRM Wizard
- [ ] ❌ Issue: ___________________________
- [ ] ✅ No critical issues

---

## Pass/Fail Criteria

### PASS ✅
All features complete basic flow without errors:
- Browser extension captures content successfully
- Email templates create, save, and apply variables
- CRM wizard displays all steps correctly
- Database tables exist and data persists

### FAIL ❌
Any of these issues:
- Extension fails to load
- Templates don't save or variables don't work
- Database errors prevent data from saving
- Critical bugs that break user flow

---

## Status

**Overall Status**: [ ] PASS | [ ] FAIL | [ ] NEEDS WORK

**Tested By**: _______________
**Date**: _______________
**Time**: _______________

---

## Next Actions

If PASS:
- [ ] Proceed to comprehensive testing (INTEGRATION_TESTING_GUIDE.md)
- [ ] Create detailed QA report with screenshots
- [ ] Move to Phase 6 (Documentation)

If FAIL:
- [ ] Document all issues
- [ ] Create bug tickets
- [ ] Fix critical issues
- [ ] Re-test

If NEEDS WORK:
- [ ] List specific improvements needed
- [ ] Prioritize fixes
- [ ] Schedule follow-up testing

---

**Quick Win**: If all checkboxes are checked, core functionality is working! 🎉

