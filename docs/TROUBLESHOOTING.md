# Pulse Messages - Troubleshooting Guide

**Version**: 1.0
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [Common Issues](#common-issues)
2. [Performance Issues](#performance-issues)
3. [Feature-Specific Issues](#feature-specific-issues)
4. [Browser Issues](#browser-issues)
5. [Network Issues](#network-issues)
6. [Data Issues](#data-issues)

---

## Common Issues

### Messages Not Sending

**Symptoms**: Message stays in "sending" state or shows error

**Solutions**:

1. **Check Internet Connection**
   ```
   - Open browser dev tools (F12)
   - Check Network tab for errors
   - Test connection: ping google.com
   ```

2. **Check Rate Limiting**
   - Wait 1 minute if sending many messages
   - Rate limit: 60 messages per minute

3. **Clear Browser Cache**
   ```
   Chrome: Ctrl+Shift+Delete > Cached images and files
   Firefox: Ctrl+Shift+Delete > Cache
   Safari: Cmd+Option+E
   ```

4. **Check Message Length**
   - Max 2000 characters
   - Reduce length if exceeded

5. **Refresh Page**
   - Press F5 or Ctrl+R
   - Messages in "sending" state will retry

**Still Not Working?**
- Contact support with error message from browser console

---

### Real-Time Updates Not Working

**Symptoms**: New messages don't appear automatically

**Solutions**:

1. **Check WebSocket Connection**
   ```javascript
   // Open browser console and run:
   supabase.channel('test').subscribe((status) => {
     console.log('Status:', status);
   });
   // Should show 'SUBSCRIBED'
   ```

2. **Firewall/Proxy Issues**
   - Check if WebSocket (WSS) is blocked
   - Try different network
   - Disable VPN temporarily

3. **Browser Extension Conflict**
   - Disable ad blockers
   - Try incognito mode
   - Disable all extensions

4. **Refresh Connection**
   - Reload page
   - Clear browser cache
   - Log out and log back in

---

### Reactions Not Appearing

**Symptoms**: Can't add reactions or reactions not visible

**Solutions**:

1. **Hover Delay Issue**
   - Hover for full 300ms
   - Don't move mouse while hovering
   - Try right-click method instead

2. **Mobile Long-Press**
   - Press and hold for 500ms
   - Don't move finger
   - Ensure haptic feedback enabled

3. **Clear Component State**
   - Refresh page
   - Clear localStorage:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

4. **Browser Compatibility**
   - Update to latest browser version
   - Reactions require Chrome 90+, Firefox 88+, Safari 14+

---

## Performance Issues

### Slow Message Loading

**Symptoms**: Messages take long to load

**Solutions**:

1. **Optimize Thread Size**
   - Archive old threads
   - Limit messages per page (50 default)
   - Use pagination

2. **Clear Browser Data**
   ```
   - Clear cache
   - Clear localStorage
   - Clear IndexedDB
   ```

3. **Disable Unused Features**
   - Turn off AI features if not needed
   - Disable real-time updates temporarily
   - Close unused tabs

4. **Check Network Speed**
   ```
   - Run speed test
   - Should be >1 Mbps for smooth experience
   - Switch to faster connection
   ```

---

### High Memory Usage

**Symptoms**: Browser using too much RAM

**Solutions**:

1. **Close Unused Threads**
   - Keep only 5-10 threads open
   - Archive completed conversations

2. **Limit Message History**
   - Load only recent 50 messages
   - Use search for older messages

3. **Restart Browser**
   - Close and reopen browser
   - Clear memory

4. **Reduce Browser Extensions**
   - Disable unused extensions
   - Extensions can consume significant memory

---

## Feature-Specific Issues

### Focus Mode Won't Start

**Symptoms**: Clicking Focus Mode has no effect

**Solutions**:

1. **Select Thread First**
   - Focus Mode requires active thread
   - Click a thread before starting

2. **Check localStorage**
   ```javascript
   // Clear focus mode state
   localStorage.removeItem('focusMode');
   location.reload();
   ```

3. **Browser Notifications**
   - Grant notification permission
   - Check browser notification settings

4. **Timer Conflict**
   - Stop any running timers
   - Reset focus mode state

---

### Search Not Finding Messages

**Symptoms**: Search returns no results for known messages

**Solutions**:

1. **Check Search Scope**
   - Ensure searching in correct thread
   - Try global search (Ctrl+Shift+F)

2. **Rebuild Search Index**
   - Settings > Advanced > Rebuild Search Index
   - Wait for completion

3. **Search Syntax**
   - Use exact phrases in quotes: "hello world"
   - Try different keywords
   - Check spelling

4. **Check Filters**
   - Remove date filters
   - Clear sender filters
   - Reset all filters

---

### AI Tools Not Working

**Symptoms**: AI features not responding or showing errors

**Solutions**:

1. **Check API Key**
   - Settings > Integrations > Gemini API
   - Verify API key is valid
   - Test connection

2. **Rate Limiting**
   - AI rate limit: 20 requests/minute
   - Wait if limit exceeded
   - Upgrade to Pro for higher limits

3. **Network Issues**
   - Check internet connection
   - Verify can reach generativelanguage.googleapis.com
   - Try different network

4. **Feature Availability**
   - Some AI tools require Pro subscription
   - Check tool badge for "Pro" label
   - Upgrade if needed

---

### CRM Integration Failing

**Symptoms**: Can't connect to CRM or sync failing

**Solutions**:

1. **OAuth Issues**
   - Re-authorize CRM connection
   - Check callback URL configured correctly
   - Verify credentials in CRM platform

2. **Permission Issues**
   - Ensure sufficient CRM permissions
   - Need "read" and "write" access
   - Contact CRM admin

3. **Sync Errors**
   - Check sync logs in Settings > Integrations
   - Verify CRM API limits not exceeded
   - Try manual sync

4. **Data Conflicts**
   - Check for duplicate contacts
   - Resolve conflicts manually
   - Re-sync after resolution

---

## Browser Issues

### Chrome Issues

**Common Problems**:
- Extensions blocking features
- Cache corruption
- Memory leaks

**Solutions**:
```
1. Clear cache: Ctrl+Shift+Delete
2. Disable extensions: chrome://extensions
3. Restart Chrome
4. Update to latest version
5. Try incognito mode
```

---

### Firefox Issues

**Common Problems**:
- WebSocket connection issues
- localStorage limits
- Privacy settings blocking features

**Solutions**:
```
1. Check privacy settings
2. Disable Enhanced Tracking Protection for Pulse
3. Increase localStorage limit: about:config > dom.storage.default_quota
4. Clear cache and cookies
```

---

### Safari Issues

**Common Problems**:
- Notification permission issues
- Cross-origin restrictions
- Service worker problems

**Solutions**:
```
1. Enable notifications: Preferences > Websites > Notifications
2. Clear website data: Preferences > Privacy > Manage Website Data
3. Update to latest Safari version
4. Check Intelligent Tracking Prevention settings
```

---

## Network Issues

### Connection Timeout

**Symptoms**: "Connection timeout" errors

**Solutions**:

1. **Check Firewall**
   - Allow pulse.example.com
   - Allow supabase.co
   - Allow generativelanguage.googleapis.com

2. **Check Proxy**
   - Configure proxy settings
   - Try direct connection
   - Contact IT if corporate proxy

3. **DNS Issues**
   - Flush DNS cache:
   ```
   Windows: ipconfig /flushdns
   Mac: sudo dscacheutil -flushcache
   Linux: sudo systemd-resolve --flush-caches
   ```

---

### Slow Connection

**Symptoms**: Everything loads slowly

**Solutions**:

1. **Test Speed**
   - Run speed test (speedtest.net)
   - Need >1 Mbps for basic functionality
   - >5 Mbps recommended for optimal experience

2. **Reduce Data Usage**
   - Disable image auto-loading
   - Limit message history
   - Turn off real-time updates temporarily

3. **Switch Network**
   - Try different Wi-Fi network
   - Use cellular data
   - Move closer to router

---

## Data Issues

### Missing Messages

**Symptoms**: Messages disappeared or not showing

**Solutions**:

1. **Check Filters**
   - Clear all search filters
   - Check if thread is archived
   - Verify not in muted threads

2. **Check Deleted**
   - Messages may have been deleted
   - Check trash/archive
   - Deleted messages can be recovered within 30 days

3. **Sync Issues**
   - Force refresh: Ctrl+R
   - Clear cache and reload
   - Re-sync with server

---

### Duplicate Messages

**Symptoms**: Same message appears multiple times

**Solutions**:

1. **Network Retry**
   - Usually caused by network issues during send
   - Delete duplicates manually
   - Will be deduplicated on server

2. **Cache Corruption**
   - Clear browser cache
   - Reload page
   - Duplicates should resolve

---

## Getting Additional Help

### Debug Information to Collect

When contacting support, provide:

1. **Browser Info**:
   ```
   - Browser name and version
   - Operating system
   - Screen resolution
   ```

2. **Error Messages**:
   ```
   - Open Dev Tools (F12)
   - Check Console tab
   - Copy all red error messages
   ```

3. **Network Info**:
   ```
   - Open Dev Tools > Network tab
   - Filter: XHR
   - Look for failed requests (red)
   - Copy request/response
   ```

4. **Steps to Reproduce**:
   ```
   - Detailed steps to trigger issue
   - Screenshots or screen recording
   - When issue started
   ```

### Contact Support

- **Email**: support@pulse.example.com
- **Chat**: Click "Help" button
- **Community**: community.pulse.example.com

### Emergency Issues

For critical issues affecting your work:
- **Priority Support**: support@pulse.example.com (Subject: URGENT)
- **Status Page**: status.pulse.example.com
- **Twitter**: @PulseApp for outage updates

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
