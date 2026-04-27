# GitCommit Skill

You are helping the user commit and push changes to GitHub with security checks.

## Task Steps

1. **Security Scan**
   - Search for sensitive files and keys that should be in .gitignore
   - Check for common sensitive patterns:
     - API keys (patterns like `API_KEY`, `SECRET_KEY`, etc.)
     - Environment files (.env, .env.local, .env.production, etc.)
     - Credentials files (credentials.json, service-account.json, etc.)
     - Private keys (.pem, .key files)
     - Database files (.db, .sqlite)
     - Node modules and build artifacts
   - Read the current .gitignore file
   - Add any missing sensitive patterns to .gitignore

2. **Git Status Check**
   - Run `git status` to see what files will be committed
   - Alert user if any sensitive files are about to be committed
   - If sensitive files found, STOP and warn the user

3. **Commit and Push**
   - Add all changes: `git add .`
   - Create a commit with a descriptive message following the repository's style
   - Push to the main branch: `git push origin main`
   - Provide a summary of what was committed

## Important Notes

- NEVER commit files containing actual secrets or credentials
- If uncertain about a file, ask the user before committing
- Always check git status before and after operations
- Follow the existing commit message style from git log
- If push fails, provide clear error message and suggestions
