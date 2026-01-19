#!/bin/bash
# Quick setup script for test infrastructure

echo "Installing MSW for API mocking..."
npm install --save-dev msw

echo ""
echo "✅ Test infrastructure is ready!"
echo ""
echo "Next steps:"
echo "1. Run unit tests: npm test"
echo "2. Run E2E tests: npm run test:e2e"
echo "3. View coverage: npm run test:coverage"
echo "4. Read docs: TESTING.md"
