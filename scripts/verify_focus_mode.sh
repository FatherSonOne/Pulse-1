#!/bin/bash
# Focus Mode Implementation Verification Script

echo "========================================="
echo "Focus Mode Implementation Verification"
echo "========================================="
echo ""

# Check component files
echo "Checking component files..."
FILES=(
  "src/components/Messages/FocusMode.tsx"
  "src/components/Messages/FocusTimer.tsx"
  "src/components/Messages/FocusControls.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    echo "✅ $file ($lines lines)"
  else
    echo "❌ $file - MISSING"
  fi
done

echo ""
echo "Checking service files..."
if [ -f "src/services/focusModeService.ts" ]; then
  lines=$(wc -l < "src/services/focusModeService.ts")
  echo "✅ src/services/focusModeService.ts ($lines lines)"
else
  echo "❌ src/services/focusModeService.ts - MISSING"
fi

echo ""
echo "Checking database migration..."
if [ -f "supabase/migrations/037_focus_mode_sessions.sql" ]; then
  lines=$(wc -l < "supabase/migrations/037_focus_mode_sessions.sql")
  echo "✅ supabase/migrations/037_focus_mode_sessions.sql ($lines lines)"
else
  echo "❌ supabase/migrations/037_focus_mode_sessions.sql - MISSING"
fi

echo ""
echo "Checking documentation..."
DOCS=(
  "src/components/Messages/FOCUS_MODE_README.md"
  "FOCUS_MODE_IMPLEMENTATION_SUMMARY.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    lines=$(wc -l < "$doc")
    echo "✅ $doc ($lines lines)"
  else
    echo "❌ $doc - MISSING"
  fi
done

echo ""
echo "Checking modified files..."
echo "Checking Messages.tsx for Focus Mode integration..."
if grep -q "isFocusModeActive" src/components/Messages.tsx; then
  echo "✅ Messages.tsx - Focus Mode state added"
else
  echo "❌ Messages.tsx - Focus Mode state NOT found"
fi

if grep -q "import.*FocusMode" src/components/Messages.tsx; then
  echo "✅ Messages.tsx - FocusMode import added"
else
  echo "❌ Messages.tsx - FocusMode import NOT found"
fi

if grep -q "Shift+F" src/components/Messages.tsx; then
  echo "✅ Messages.tsx - Keyboard shortcut added"
else
  echo "❌ Messages.tsx - Keyboard shortcut NOT found"
fi

echo ""
echo "Checking messageStore.ts for Focus Mode state..."
if grep -q "focusSession" src/store/messageStore.ts; then
  echo "✅ messageStore.ts - Focus Mode state added"
else
  echo "❌ messageStore.ts - Focus Mode state NOT found"
fi

if grep -q "toggleFocusMode" src/store/messageStore.ts; then
  echo "✅ messageStore.ts - Focus Mode actions added"
else
  echo "❌ messageStore.ts - Focus Mode actions NOT found"
fi

echo ""
echo "Checking exports..."
if grep -q "FocusMode\|FocusTimer\|FocusControls" src/components/Messages/index.tsx; then
  echo "✅ index.tsx - Focus Mode components exported"
else
  echo "❌ index.tsx - Focus Mode exports NOT found"
fi

echo ""
echo "========================================="
echo "Verification Complete"
echo "========================================="
