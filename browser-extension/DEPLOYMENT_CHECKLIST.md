# Chrome Web Store Deployment Checklist

## Pre-Deployment Requirements

### 1. Chrome Web Store Developer Account
- [ ] Create developer account at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- [ ] Pay one-time $5 registration fee
- [ ] Verify email address
- [ ] Complete developer profile

---

## Extension Preparation

### 2. Code & Assets Ready
- [x] All source files complete
- [x] Icons generated (16x, 32x, 48x, 128x)
- [x] Manifest.json validated
- [x] No console errors
- [x] Authentication flow tested
- [ ] Remove development-only code
- [ ] Remove debug console.logs
- [ ] Minify JavaScript (optional but recommended)

### 3. Version & Metadata
Current version in manifest.json:
```json
"version": "1.0.0"
```

- [ ] Verify version number follows [semver](https://semver.org/)
- [ ] Update version for each submission
- [ ] Add version notes to changelog

---

## Store Listing Assets

### 4. Screenshots Required
You need **at least 1 screenshot**, but 5 is recommended.

**Dimensions**: 1280x800 or 640x400 pixels

**Recommended Screenshots**:
1. **Quick Capture Popup** - Main extension popup showing capture UI
2. **Selection Capture** - Text highlighted with floating capture button
3. **Project Selection** - Dropdown showing War Room projects
4. **Success State** - Toast notification "Captured to Pulse!"
5. **Settings Page** - Options page showing configuration

**Where to capture**:
- Use `Ctrl+Shift+P` to open popup, then screenshot
- Highlight text on a sample page
- Open options page via `chrome://extensions/`

**Tools**:
- Windows: Snipping Tool or `Win+Shift+S`
- Chrome DevTools: Device toolbar for consistent sizing
- [Figma](https://figma.com/) for adding annotations/callouts

### 5. Promotional Images (Optional but Recommended)

**Small Tile** (440x280 pixels):
- Brand icon + "Pulse" text
- Tagline: "Quick Capture for War Room"

**Large Tile** (920x680 pixels):
- Hero image with extension in action
- Benefits listed visually

**Marquee** (1400x560 pixels):
- Wide banner for featured listings
- "Capture web content to your Pulse projects"

**Tools**:
- [Canva](https://canva.com/) - Free design tool
- Figma - Professional design
- Adobe Photoshop/Illustrator

---

## Store Listing Content

### 6. Extension Description

**Short Description** (132 characters max):
```
Capture web content to Pulse War Room. Save articles, research, and notes instantly to your projects.
```

**Detailed Description** (up to 16,000 characters):
```markdown
# Pulse - Quick Capture for War Room

Transform how you collect and organize web research. Pulse browser extension lets you capture any content from the web directly to your War Room projects with one click.

## ✨ Features

### 🚀 Quick Capture
Press Ctrl+Shift+P to instantly save highlighted text, articles, or full pages to Pulse.

### 📋 Smart Selection
Highlight any text on any webpage. Pulse detects your selection and shows a floating capture button.

### 📁 Project Integration
Save directly to your War Room projects. Keep research organized where you need it.

### ⌨️ Keyboard Shortcuts
- **Ctrl+Shift+P** - Open Quick Capture popup
- **Ctrl+Shift+S** - Capture selected text
- **Ctrl+Shift+A** - Capture entire page

### 🎯 Context Menu
Right-click to capture:
- Selected text
- Entire page
- Links
- Images

### 🔒 Secure Authentication
Sign in once with Google. Your content is saved directly to your Pulse account.

### 🎨 Beautiful Design
Dark theme UI that matches Pulse's modern aesthetic.

## 📖 How to Use

1. **Install** the extension
2. **Sign in** with your Pulse account
3. **Highlight** text on any webpage
4. **Click** the capture button or use keyboard shortcut
5. **Choose** a project (optional)
6. **Done!** Content is saved to your War Room

## 🔐 Privacy & Security

- Your authentication is handled securely through Pulse
- Captured content goes directly to your Pulse account
- No data is collected or stored by the extension
- Open source and transparent

## 💡 Perfect For

- 📚 Researchers collecting sources
- 📝 Writers gathering references
- 🎓 Students organizing study materials
- 💼 Professionals tracking industry news
- 🚀 Product teams collecting feedback

## 🌐 Requires Pulse Account

This extension requires a Pulse account to save content. Visit [pulse.logosvision.org](https://pulse.logosvision.org) to sign up.

## 🆘 Support

Need help? Contact us:
- Email: support@logosvision.org
- Website: https://pulse.logosvision.org
- Documentation: https://pulse.logosvision.org/docs

## 📜 License

Copyright © 2026 Logos Vision LLC. All rights reserved.

---

**Made with ❤️ by the Pulse team**
```

### 7. Category & Language
- [ ] **Primary Category**: Productivity
- [ ] **Language**: English (en)
- [ ] **Additional languages** (if extension is translated)

### 8. Privacy Policy (REQUIRED)
You MUST have a privacy policy URL.

**URL**: `https://pulse.logosvision.org/privacy`

**Ensure your privacy policy covers**:
- What data the extension collects (authentication tokens, captured content)
- How data is used (saved to user's Pulse account)
- Third-party services (Supabase, Google OAuth)
- Data retention
- User rights (access, deletion)
- Contact information

**If you don't have a privacy page yet**, you need to create one.

---

## Technical Requirements

### 9. Manifest Validation
Run through Chrome's manifest validator:

```bash
# Validate manifest.json syntax
node -c browser-extension/manifest.json
```

- [x] Valid JSON syntax
- [x] All required fields present
- [x] Icon paths exist
- [x] Permissions justified
- [x] Host permissions minimal

### 10. Content Security Policy (CSP)
Manifest V3 has default CSP, but verify:

- [ ] No inline scripts (all JS in separate files) ✅
- [ ] No remote script loading ✅
- [ ] No unsafe operations ✅

### 11. Permissions Justification
You'll need to explain why each permission is needed:

**activeTab**:
> "Required to access the content of the current tab for capturing selected text and page content."

**storage**:
> "Required to save user preferences, authentication session, and default project settings."

**contextMenus**:
> "Required to add right-click menu options for quick content capture."

**notifications**:
> "Required to show success/failure notifications when content is captured."

**host_permissions**:
> "Required to communicate with Pulse backend (pulse.logosvision.org) and Supabase database for saving captured content."

---

## Package Preparation

### 12. Create Distribution Package

**Option A: Manual ZIP**
```bash
cd browser-extension
# Create a zip file excluding development files
```

**Option B: Build Script**
Create `build-extension.js`:

```javascript
import fs from 'fs';
import archiver from 'archiver';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const output = fs.createWriteStream(path.join(__dirname, '..', 'pulse-extension-v1.0.0.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✓ Extension packaged: ${archive.pointer()} bytes`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all files except development files
archive.directory('browser-extension/', false, (entry) => {
  // Exclude development files
  const exclude = [
    'generate-icons.js',
    'build-extension.js',
    '.DS_Store',
    'Thumbs.db',
    '*.md',
    'node_modules'
  ];

  const shouldExclude = exclude.some(pattern => {
    if (pattern.includes('*')) {
      return entry.name.endsWith(pattern.replace('*', ''));
    }
    return entry.name.includes(pattern);
  });

  return !shouldExclude;
});

archive.finalize();
```

**Files to INCLUDE**:
- ✅ manifest.json
- ✅ popup.html
- ✅ options.html
- ✅ src/*.js
- ✅ styles/*.css
- ✅ icons/*.png

**Files to EXCLUDE**:
- ❌ README.md
- ❌ SETUP.md
- ❌ TESTING_GUIDE.md
- ❌ AUTH_VERIFICATION.md
- ❌ DEPLOYMENT_CHECKLIST.md
- ❌ generate-icons.js
- ❌ node_modules
- ❌ .git

### 13. Test the ZIP Package
- [ ] Extract ZIP to new folder
- [ ] Load unpacked in Chrome
- [ ] Verify all features work
- [ ] No missing file errors

---

## Chrome Web Store Submission

### 14. Upload to Dashboard

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Click **"New Item"**
3. Upload your ZIP file
4. Wait for upload and validation

### 15. Fill Out Store Listing

**Product Details**:
- [ ] Extension name: "Pulse - Quick Capture"
- [ ] Short description (132 char)
- [ ] Detailed description
- [ ] Category: Productivity
- [ ] Language: English

**Graphic Assets**:
- [ ] Icon (128x128) - already in ZIP
- [ ] Screenshot 1 (required)
- [ ] Screenshot 2
- [ ] Screenshot 3
- [ ] Screenshot 4
- [ ] Screenshot 5
- [ ] Small promo tile (optional)
- [ ] Large promo tile (optional)
- [ ] Marquee promo tile (optional)

**Distribution**:
- [ ] **Visibility**: Public (or Unlisted for beta)
- [ ] **Regions**: All regions (or specific countries)

**Pricing & Distribution**:
- [ ] Free (no in-app purchases)

**Privacy Practices**:
- [ ] Privacy policy URL: `https://pulse.logosvision.org/privacy`
- [ ] Data usage disclosure:
  - [ ] Collects authentication data
  - [ ] Collects user-created content
  - [ ] Data is not sold
  - [ ] Data is transmitted securely

**Permissions Justification**:
- [ ] Explain each permission (see section 11)

### 16. Single Purpose Description
Chrome requires a "single purpose" statement:

```
Pulse extension has a single purpose: to enable users to quickly capture and save web content (text, articles, links, images) to their Pulse War Room projects for organization and reference.
```

### 17. Deceptive Behavior Attestation
- [ ] Confirm extension doesn't engage in:
  - Spam
  - Malware
  - Deceptive installation
  - User data misuse
  - System interference

---

## Review Process

### 18. Submit for Review
- [ ] Click **"Submit for Review"**
- [ ] Wait for automated checks (5-10 minutes)
- [ ] Address any immediate errors

### 19. Review Timeline
- **Typical**: 1-3 business days
- **First submission**: May take 1 week
- **Updates**: Usually faster (1-2 days)

### 20. Respond to Review Feedback
If reviewer requests changes:
- [ ] Read feedback carefully
- [ ] Make requested changes
- [ ] Update version number
- [ ] Resubmit

---

## Post-Approval

### 21. Verify Live Listing
- [ ] Extension appears in Chrome Web Store
- [ ] Install button works
- [ ] Description displays correctly
- [ ] Screenshots render properly
- [ ] Privacy policy link works

### 22. Monitor User Feedback
- [ ] Check reviews daily
- [ ] Respond to user questions
- [ ] Track common issues
- [ ] Plan updates based on feedback

### 23. Marketing & Distribution
- [ ] Add Chrome Web Store link to Pulse website
- [ ] Announce on social media
- [ ] Email existing users
- [ ] Add to documentation
- [ ] Create tutorial video (optional)

**Chrome Web Store URL** (after approval):
```
https://chrome.google.com/webstore/detail/[your-extension-id]
```

### 24. Analytics Setup (Optional)
- [ ] Add Google Analytics to extension (if desired)
- [ ] Track usage metrics
- [ ] Monitor error rates
- [ ] Measure adoption

---

## Update Process

### When to Update
- Bug fixes (increment patch: 1.0.0 → 1.0.1)
- New features (increment minor: 1.0.0 → 1.1.0)
- Breaking changes (increment major: 1.0.0 → 2.0.0)

### Update Checklist
- [ ] Increment version in manifest.json
- [ ] Test all features still work
- [ ] Update changelog
- [ ] Create new ZIP
- [ ] Upload to store
- [ ] Add "What's new" description
- [ ] Submit for review

---

## Troubleshooting

### Common Rejection Reasons

**1. Missing Privacy Policy**
- Solution: Create privacy page, add URL to listing

**2. Excessive Permissions**
- Solution: Justify each permission, remove unnecessary ones

**3. Unclear Single Purpose**
- Solution: Rewrite description to focus on ONE main function

**4. Quality Issues**
- Solution: Fix bugs, improve UI, add better screenshots

**5. Trademark Issues**
- Solution: Ensure name doesn't violate trademarks

### Appeal Process
If rejected unfairly:
1. Review rejection reason carefully
2. Address all concerns
3. Resubmit with explanation
4. Contact developer support if needed

---

## Optional Enhancements

### Before or After Launch
- [ ] Create tutorial video
- [ ] Add onboarding flow in extension
- [ ] Implement analytics
- [ ] Add user feedback form
- [ ] Create keyboard shortcut customization
- [ ] Add dark/light theme toggle
- [ ] Implement offline mode
- [ ] Add export functionality

---

## Key Resources

### Documentation
- [Chrome Web Store Publishing Guide](https://developer.chrome.com/docs/webstore/publish/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)

### Tools
- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- [Extension Icon Generator](https://www.favicon-generator.org/)
- [Screenshot Tools](https://www.screely.com/) - Add browser mockups
- [Canva](https://canva.com/) - Create promotional images

### Support
- [Chrome Extension Community](https://groups.google.com/a/chromium.org/g/chromium-extensions)
- [Stack Overflow - chrome-extension](https://stackoverflow.com/questions/tagged/chrome-extension)

---

## Final Checklist

### Pre-Submission ✅
- [x] Extension fully functional
- [x] All icons generated
- [x] Authentication tested
- [ ] Privacy policy published
- [ ] Screenshots captured
- [ ] Description written
- [ ] ZIP package created and tested

### During Submission ✅
- [ ] Developer account registered
- [ ] Store listing filled out
- [ ] All permissions justified
- [ ] Privacy practices declared
- [ ] Single purpose stated
- [ ] Submitted for review

### Post-Approval ✅
- [ ] Verified live listing
- [ ] Updated Pulse website
- [ ] Announced launch
- [ ] Monitoring reviews
- [ ] Planning next update

---

## Deployment Timeline Estimate

**Day 1**: Prepare assets (screenshots, descriptions)
**Day 2**: Create ZIP, test package
**Day 3**: Submit to Chrome Web Store
**Day 4-7**: Wait for review
**Day 8**: Address feedback (if any)
**Day 9-10**: Final approval & go live

**Total**: ~2 weeks for first submission

---

## Notes

### Important Reminders
1. **Version must increment** with each submission
2. **Privacy policy is REQUIRED** - no exceptions
3. **Screenshots make or break adoption** - invest time here
4. **First review takes longest** - be patient
5. **Respond to users quickly** - builds trust

### Success Metrics
Track these after launch:
- **Installations**: Target 100 in first month
- **Active Users**: Daily/weekly active users
- **Retention**: 7-day, 30-day retention rates
- **Ratings**: Maintain 4.5+ stars
- **Reviews**: Respond to all within 24 hours

---

**Prepared By**: Claude Code
**Date**: January 21, 2026
**Status**: Ready for Submission ✅

**Good luck with your Chrome Web Store launch! 🚀**
