---
description: GitHub Feature Development Workflow
---

1. Start from dev
   - Ensure you are on the `dev` branch and it is up to date.
   - Command: `git checkout dev && git pull origin dev`

2. Create Feature Branch
   - Create a new branch for your feature.
   - Command: `git checkout -b feature/[feature-name]`

3. Implement Changes
   - Make your code changes.
   - Verify functionality.

4. Pull Request
   - Stage and commit your changes.
   - Command: `git add . && git commit -m "[commit message]"`
   - Push to remote.
   - Command: `git push -u origin feature/[feature-name]`
   - Create a Pull Request to merge into `dev`.
