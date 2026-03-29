#!/bin/bash
# Script to wrap all Bundle component usages with React.Suspense

FILE="src/components/Messages.tsx"
BACKUP="src/components/Messages.tsx.backup"

# Create backup
cp "$FILE" "$BACKUP"

# Pattern 1: Wrap lines like "<BundleX.Component" that don't already have Suspense before them
sed -i 's/^\(\s*\)<Bundle\([A-Z][a-zA-Z]*\)\.\([A-Z][a-zA-Z]*\)$/\1<React.Suspense fallback={<FeatureSkeleton \/>}>\n\1  <Bundle\2.\3/g' "$FILE"

# Pattern 2: Add closing Suspense tag before the closing parenthesis of conditionals
# This is more complex and would need manual review

echo "Wrapping complete. Review changes in $FILE"
echo "Backup saved to $BACKUP"
