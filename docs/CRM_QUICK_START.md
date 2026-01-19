# CRM Integration - Quick Start Guide

Get your CRM integration up and running in minutes.

---

## 1. Environment Setup

Add OAuth credentials to your `.env` file:

```env
# Choose the CRMs you want to integrate
VITE_HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_secret
HUBSPOT_REDIRECT_URI=http://localhost:3003/api/crm/callback/hubspot

# Repeat for Salesforce, Pipedrive, and/or Zoho
```

**Important:** Frontend vars need `VITE_` prefix. Backend vars don't.

---

## 2. Start the Server

The Express server handles OAuth callbacks:

```bash
npm run server
# Server runs on http://localhost:3003
```

---

## 3. Add Setup Wizard to Your App

```tsx
import { IntegrationSetupWizard } from './components/crm';

function Settings() {
  const [showWizard, setShowWizard] = useState(false);
  const [integrations, setIntegrations] = useState([]);

  return (
    <>
      <button onClick={() => setShowWizard(true)}>
        Connect CRM
      </button>

      <IntegrationSetupWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={(integration) => {
          setIntegrations([...integrations, integration]);
          setShowWizard(false);
        }}
      />
    </>
  );
}
```

---

## 4. Add Action Buttons to Messages

```tsx
import { CRMActionButtons } from './components/crm';

function MessageView({ message, crmIntegrations }) {
  return (
    <div>
      <p>{message.content}</p>

      <CRMActionButtons
        integrations={crmIntegrations}
        contactId={message.contactId}
        messageId={message.id}
        chatId={message.chatId}
        messageContent={message.content}
      />
    </div>
  );
}
```

---

## 5. Add Sync Status Panel

```tsx
import { SyncStatusPanel } from './components/crm';

function CRMDashboard() {
  const [integrations, setIntegrations] = useState([]);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    const res = await fetch('/api/crm/integrations', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const { data } = await res.json();
    setIntegrations(data);
  };

  return (
    <SyncStatusPanel
      integrations={integrations}
      onRefresh={fetchIntegrations}
    />
  );
}
```

---

## 6. Add CRM Sidepanel

```tsx
import { CRMSidepanelComponent } from './components/crm';

function ChatView({ currentChat, linkedDeal }) {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {/* Messages */}
      </div>

      <CRMSidepanelComponent
        chatId={currentChat.id}
        deal={linkedDeal}
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
      />
    </div>
  );
}
```

---

## Common Workflows

### Creating a CRM Task from a Message

```tsx
import { crmActionsService } from './services/crmActionsService';

async function createTaskFromMessage(message, integration) {
  await crmActionsService.createAction(
    'create_task',
    integration.id,
    message.contactId,
    {
      fields: {
        title: 'Follow up',
        description: message.content,
        priority: 'high',
        dueDate: new Date(Date.now() + 86400000),
      },
    },
    userId,
    {
      chatId: message.chatId,
      messageId: message.id,
    }
  );
}
```

### Running a Manual Sync

```tsx
async function syncCRM(integrationId) {
  await fetch(`/api/crm/integrations/${integrationId}/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
```

### Fetching Sync Logs

```tsx
async function getSyncLogs(integrationId) {
  const res = await fetch(
    `/api/crm/integrations/${integrationId}/sync-logs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const { data } = await res.json();
  return data; // Array of SyncLog objects
}
```

---

## Troubleshooting

### OAuth Popup Blocked

If the OAuth popup is blocked:

1. Allow popups for your domain
2. Or open OAuth URL in same window:
   ```tsx
   window.location.href = authUrl;
   ```

### "Missing OAuth credentials" Error

- Check `.env` file has all required variables
- Restart dev server after adding env vars
- Ensure `VITE_` prefix for frontend vars

### Sync Not Working

- Check CRM API credentials are valid
- Verify required OAuth scopes are granted
- Check server logs for error messages
- Test connection in CRM settings

### Token Expired

- Tokens auto-refresh when expired
- If refresh fails, user needs to re-authorize
- Check `token_expires_at` in database

---

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/crm/callback/:platform` | GET | OAuth callback handler |
| `/api/crm/integrations` | GET | List user's integrations |
| `/api/crm/integrations` | POST | Create new integration |
| `/api/crm/integrations/:id` | PATCH | Update integration |
| `/api/crm/integrations/:id` | DELETE | Delete integration |
| `/api/crm/integrations/:id/sync` | POST | Trigger manual sync |
| `/api/crm/integrations/:id/sync-logs` | GET | Get sync history |

---

## Component Props Reference

### IntegrationSetupWizard

```tsx
interface IntegrationSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (integration: CRMIntegration) => void;
}
```

### CRMActionButtons

```tsx
interface CRMActionButtonsProps {
  integrations: CRMIntegration[];
  contactId?: string;
  dealId?: string;
  messageId?: string;
  chatId?: string;
  messageContent?: string;
}
```

### SyncStatusPanel

```tsx
interface SyncStatusPanelProps {
  integrations: CRMIntegration[];
  onRefresh?: () => void;
}
```

### CRMSidepanelComponent

```tsx
interface CRMSidepanelProps {
  chatId: string;
  deal?: CRMDeal;
  isOpen: boolean;
  onClose: () => void;
}
```

---

## Next Steps

1. **Test OAuth flow** - Try connecting each CRM platform
2. **Create test tasks** - Use action buttons to create tasks in your CRM
3. **Run a sync** - Manually sync data and check sync logs
4. **Customize styling** - Update CSS to match your design system
5. **Add analytics** - Track CRM action usage

---

## Support

- **Documentation**: `f:/pulse1/docs/CRM_SETUP_GUIDE.md`
- **Examples**: `f:/pulse1/src/services/crm/examples.ts`
- **Implementation**: `f:/pulse1/docs/CRM_FRONTEND_IMPLEMENTATION.md`

Need help? Check the comprehensive docs above or reach out to the team.

---

**Happy integrating! 🚀**
