# Email Phase 1 API Documentation

## Overview
This document describes the REST API endpoints for Email Phase 1 features, including email signatures, custom labels, filters, advanced search, and bulk operations.

## Authentication
All endpoints require authentication via Supabase JWT token. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Email Signatures

### Get All Signatures
```http
GET /api/email/signatures
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Work Signature",
    "content": "<p>Best regards,<br>John Doe</p>",
    "is_html": true,
    "is_default": true,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
]
```

### Create Signature
```http
POST /api/email/signatures
Content-Type: application/json

{
  "name": "Personal",
  "content": "Cheers!\nJohn",
  "is_html": false,
  "is_default": false
}
```

### Update Signature
```http
PUT /api/email/signatures
Content-Type: application/json

{
  "id": "uuid",
  "name": "Updated Name",
  "content": "Updated content"
}
```

### Delete Signature
```http
DELETE /api/email/signatures?id=uuid
```

### Set Default Signature
```http
POST /api/email/signatures/[id]/default
```

---

## Custom Labels

### Get All Labels
```http
GET /api/email/labels?includeSystem=true
```

**Query Parameters:**
- `includeSystem` (boolean): Include system labels (default: true)

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Important",
    "color": "#FF0000",
    "gmail_label_id": "Label_123",
    "is_system": false,
    "message_list_visibility": "show",
    "label_list_visibility": "labelShow",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
]
```

### Create Label
```http
POST /api/email/labels
Content-Type: application/json

{
  "name": "Work",
  "color": "#0000FF",
  "message_list_visibility": "show",
  "label_list_visibility": "labelShow"
}
```

### Update Label
```http
PUT /api/email/labels
Content-Type: application/json

{
  "id": "uuid",
  "color": "#00FF00"
}
```

### Delete Label
```http
DELETE /api/email/labels?id=uuid
```

### Sync with Gmail
```http
POST /api/email/labels/sync
```

Syncs labels from Gmail to Pulse.

---

## Email Filters

### Get All Filters
```http
GET /api/email/filters?activeOnly=false
```

**Query Parameters:**
- `activeOnly` (boolean): Return only active filters (default: false)

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Important Clients",
    "is_active": true,
    "priority": 1,
    "conditions": {
      "from": ["client@example.com"],
      "hasAttachment": true
    },
    "actions": {
      "markAsRead": false,
      "addLabel": "Important",
      "markAsStarred": true
    },
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
]
```

### Create Filter
```http
POST /api/email/filters
Content-Type: application/json

{
  "name": "Newsletter Filter",
  "conditions": {
    "from": ["newsletter@example.com"],
    "subjectContains": ["newsletter", "digest"]
  },
  "actions": {
    "markAsRead": true,
    "addLabel": "Newsletters",
    "archive": true
  },
  "is_active": true,
  "priority": 5
}
```

**Filter Conditions:**
- `from`: string[] - Match sender email addresses
- `to`: string[] - Match recipient email addresses
- `subject`: string - Exact subject match
- `subjectContains`: string[] - Subject contains any of these strings
- `subjectMatches`: string - Regex pattern for subject
- `bodyContains`: string[] - Body contains any of these strings
- `hasAttachment`: boolean - Has attachments
- `isRead`: boolean - Read status
- `isStarred`: boolean - Starred status
- `labels`: string[] - Has any of these labels
- `larger`: number - Size larger than (bytes)
- `smaller`: number - Size smaller than (bytes)

**Filter Actions:**
- `markAsRead`: boolean - Mark as read
- `markAsUnread`: boolean - Mark as unread
- `markAsStarred`: boolean - Star the email
- `addLabel`: string - Add label by name
- `archive`: boolean - Archive the email
- `delete`: boolean - Delete the email
- `forward`: string - Forward to email address

### Update Filter
```http
PUT /api/email/filters
Content-Type: application/json

{
  "id": "uuid",
  "is_active": false
}
```

### Delete Filter
```http
DELETE /api/email/filters?id=uuid
```

### Toggle Filter
```http
POST /api/email/filters/[id]/toggle
```

Toggles the filter's active status.

---

## Advanced Search

### Search Emails
```http
GET /api/email/search?q=from:john@example.com has:attachment is:unread
```

**Query Parameter:**
- `q` (required): Search query string

**Search Operators:**
- `from:email` - From specific sender
- `to:email` - To specific recipient
- `subject:text` - Subject contains text
- `has:attachment` - Has attachments
- `is:read` / `is:unread` - Read status
- `is:starred` / `is:unstarred` - Starred status
- `label:name` - Has specific label
- `before:YYYY/MM/DD` - Before date
- `after:YYYY/MM/DD` - After date
- `older_than:Nd` - Older than N days (supports h, d, w, m, y)
- `newer_than:Nd` - Newer than N days
- `size:NMB` - Exact size
- `larger:NMB` - Larger than size (supports B, KB, MB, GB)
- `smaller:NMB` - Smaller than size
- `filename:name` - Attachment filename
- `-operator:value` - Negation (exclude)
- `OR` - Logical OR between terms

**Examples:**
```
from:boss@company.com subject:urgent
has:attachment is:unread after:2024/01/01
label:important OR label:urgent
larger:5MB filename:report.pdf
```

**Response:**
```json
{
  "query": "from:john@example.com has:attachment",
  "parsedQuery": {
    "from": ["john@example.com"],
    "hasAttachment": true
  },
  "results": [
    {
      "id": "uuid",
      "subject": "Project Files",
      "from": "john@example.com",
      "timestamp": "2024-01-15T10:00:00Z",
      "has_attachments": true
    }
  ],
  "count": 1
}
```

---

## Bulk Operations

### Execute Bulk Operation
```http
POST /api/email/bulk
Content-Type: application/json

{
  "operation": "markAsRead",
  "emailIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Supported Operations:**

#### Mark as Read
```json
{
  "operation": "markAsRead",
  "emailIds": ["uuid1", "uuid2"],
  "trackForUndo": true
}
```

#### Mark as Unread
```json
{
  "operation": "markAsUnread",
  "emailIds": ["uuid1", "uuid2"]
}
```

#### Archive
```json
{
  "operation": "archive",
  "emailIds": ["uuid1", "uuid2"]
}
```

#### Delete
```json
{
  "operation": "delete",
  "emailIds": ["uuid1", "uuid2"],
  "permanent": false
}
```

#### Star/Unstar
```json
{
  "operation": "star",
  "emailIds": ["uuid1", "uuid2"]
}
```

#### Add/Remove Label
```json
{
  "operation": "addLabel",
  "emailIds": ["uuid1", "uuid2"],
  "labelId": "label-uuid"
}
```

#### Move to Folder
```json
{
  "operation": "move",
  "emailIds": ["uuid1", "uuid2"],
  "toFolder": "Archive"
}
```

#### Export
```json
{
  "operation": "export",
  "emailIds": ["uuid1", "uuid2"],
  "format": "json"
}
```

Supported formats: `json`, `csv`, `eml`

#### Apply Filters
```json
{
  "operation": "applyFilters",
  "emailIds": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "success": true,
  "processed": 3,
  "failed": 0,
  "undoData": {
    "operation": "markAsRead",
    "emailIds": ["uuid1", "uuid2", "uuid3"],
    "previousState": [...]
  }
}
```

### Undo Operation
```http
POST /api/email/bulk/undo
Content-Type: application/json

{
  "undoData": {
    "operation": "markAsRead",
    "emailIds": ["uuid1", "uuid2"],
    "previousState": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Operation undone successfully"
}
```

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**HTTP Status Codes:**
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no response body
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `405 Method Not Allowed` - HTTP method not supported
- `500 Internal Server Error` - Server error

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per minute for read operations
- 30 requests per minute for write operations
- 10 requests per minute for bulk operations

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800
```

---

## Webhooks

Subscribe to real-time email events:

### Available Events
- `email.received` - New email received
- `email.read` - Email marked as read
- `email.starred` - Email starred
- `email.labeled` - Label applied to email
- `filter.applied` - Filter applied to email

### Webhook Payload
```json
{
  "event": "email.received",
  "timestamp": "2024-01-15T10:00:00Z",
  "userId": "uuid",
  "data": {
    "emailId": "uuid",
    "subject": "New Message",
    "from": "sender@example.com"
  }
}
```

---

## Best Practices

1. **Batch Operations**: Use bulk endpoints for operating on multiple emails
2. **Search Optimization**: Use specific operators to narrow search results
3. **Filter Priority**: Higher priority filters are applied first (1 = highest)
4. **Error Handling**: Always handle error responses gracefully
5. **Pagination**: Use limit and offset for large result sets
6. **Caching**: Cache label and signature data to reduce API calls
7. **Webhooks**: Use webhooks for real-time updates instead of polling

---

## Example Client Code

### TypeScript/JavaScript
```typescript
// Create a new filter
async function createEmailFilter(name: string, conditions: any, actions: any) {
  const response = await fetch('/api/email/filters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name, conditions, actions, is_active: true })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Bulk mark as read with undo support
async function bulkMarkAsRead(emailIds: string[]) {
  const response = await fetch('/api/email/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      operation: 'markAsRead',
      emailIds,
      trackForUndo: true
    })
  });

  const result = await response.json();
  
  // Store undo data for later use
  if (result.undoData) {
    localStorage.setItem('lastUndoData', JSON.stringify(result.undoData));
  }

  return result;
}

// Advanced search
async function searchEmails(query: string) {
  const response = await fetch(`/api/email/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return response.json();
}
```

---

## Version History

- **v1.0.0** (2024-01-15) - Initial Phase 1 API release
  - Email signatures CRUD
  - Custom labels with Gmail sync
  - Email filters with rule engine
  - Advanced search with operators
  - Bulk operations with undo support
