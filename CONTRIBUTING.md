# Contributing to Pulse

Thank you for considering contributing to Pulse! We welcome contributions from the community.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Pulse-1.git
   cd Pulse-1
   ```
3. **Create a branch** for your feature:
   ```bash
   git checkout -b feature/my-amazing-feature
   ```
4. **Make your changes** and commit them (see commit guidelines below)
5. **Push to your fork**:
   ```bash
   git push origin feature/my-amazing-feature
   ```
6. **Open a Pull Request** on GitHub

---

## 📝 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history:

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring (no functional changes)
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, semicolons, etc.)
- `test:` - Adding or updating tests
- `chore:` - Build process, dependencies, tooling
- `perf:` - Performance improvements

### Examples
```bash
# Feature
git commit -m "feat(voxer): add real-time transcription support"

# Bug fix
git commit -m "fix(messages): resolve duplicate message rendering"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Refactoring
git commit -m "refactor(crm): simplify OAuth token refresh logic"
```

---

## 🧪 Testing

Before submitting a PR, ensure all tests pass:

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Check coverage
npm run test:coverage
```

Add tests for new features:
- Unit tests in `src/__tests__/`
- Integration tests in `src/__tests__/integration/`
- E2E tests in `e2e/`

---

## 🎨 Code Style

We use ESLint and Prettier for consistent code style:

```bash
# Check linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

### Guidelines
- Use TypeScript for all new code
- Follow existing code structure and patterns
- Keep components small and focused
- Write meaningful variable and function names
- Add JSDoc comments for complex functions
- Avoid `any` types - use proper TypeScript types

---

## 📂 Project Structure

When adding new features, follow this structure:

```
src/
├── components/           # React components
│   ├── ComponentName/   # One folder per component
│   │   ├── index.tsx    # Component implementation
│   │   ├── types.ts     # Component-specific types
│   │   └── styles.css   # Component styles (if needed)
├── services/            # Business logic
│   └── serviceName.ts   # Service files
├── types/               # Shared TypeScript types
└── __tests__/           # Test files (mirror src structure)
```

---

## 🔍 Pull Request Process

1. **Update documentation** if you've changed APIs or added features
2. **Add tests** for new functionality
3. **Update CHANGELOG.md** with your changes
4. **Ensure CI passes** (all tests, linting, build)
5. **Request review** from maintainers
6. **Address feedback** promptly

### PR Title Format
Follow the same convention as commits:
```
feat(scope): add amazing new feature
```

### PR Description Template
```markdown
## What does this PR do?
Brief description of changes

## Why?
Explain the motivation

## How to test?
Steps to verify the changes work

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Changelog updated
```

---

## 🐛 Reporting Bugs

Use GitHub Issues to report bugs. Include:

- **Description**: Clear description of the bug
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Environment**: OS, browser, Node version
- **Error logs**: Console errors or stack traces

---

## 💡 Suggesting Features

We love feature suggestions! Open an issue with:

- **Problem**: What problem does this solve?
- **Solution**: Proposed solution
- **Alternatives**: Other solutions you considered
- **Examples**: Screenshots or mockups if applicable

---

## 🌟 Recognition

Contributors will be:
- Added to the Contributors section in README
- Mentioned in release notes
- Given credit in relevant documentation

---

## 📞 Questions?

- Open a [GitHub Discussion](https://github.com/FatherSonOne/Pulse-1/discussions)
- Check existing [Issues](https://github.com/FatherSonOne/Pulse-1/issues)
- Read the [Documentation](docs/)

---

## 🎯 Good First Issues

Look for issues tagged with `good-first-issue` - these are great for newcomers!

---

Thank you for contributing to Pulse! 🚀
