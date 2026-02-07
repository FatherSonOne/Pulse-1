# Privacy Dashboard Integration Guide

## Overview
This guide explains how to integrate the data export and deletion services into the PrivacyDashboard component.

## Files Created

### 1. Database Migration
**File:** `supabase/migrations/042_data_export_privacy.sql`
- Creates `data_exports` table for tracking export requests
- Creates `data_deletion_requests` table for deletion workflow
- Creates `activity_logs` table for privacy audit trail
- Sets up Supabase Storage bucket for ZIP files
- Implements RLS policies for security

### 2. Data Export Service
**File:** `src/services/dataExportService.ts`
- Handles data export requests
- Generates ZIP files with user data (JSON + CSV formats)
- Uploads to Supabase Storage with 30-day expiration
- Tracks download history
- Exports: settings, contacts, calendar, messages, emails

### 3. Data Privacy Service
**File:** `src/services/dataPrivacyService.ts`
- Handles data deletion requests with confirmation
- Implements GDPR-compliant deletion workflow
- Supports partial and full account deletion
- Sends confirmation emails (placeholder)
- Tracks deletion history

## Installing Dependencies

Add JSZip for ZIP file generation:

```bash
npm install jszip
npm install --save-dev @types/jszip
```

## Running the Migration

### Option 1: Supabase CLI
```bash
cd supabase
supabase migration up
```

### Option 2: Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `042_data_export_privacy.sql`
3. Execute the SQL

## Integration Complete
Services are ready to use! See detailed integration steps in the file.
