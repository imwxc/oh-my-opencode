import { COMPLETED_PLANS_DIR } from "../../boulder-state"

export const COMPLETED_PLANS_TEMPLATE = `<system-reminder>

[SYSTEM DIRECTIVE: COMPLETED PLANS LISTING]

## Task: List Completed Plans

### What You Need To Do

1. Read the completed plans directory: \`${COMPLETED_PLANS_DIR}\`
2. List all .md files in that directory
3. For each plan, show:
   - Plan name (filename without .md extension)
   - Last modified time (from file mtime)
4. If the directory is empty or doesn't exist, show a friendly message

### Output Format

\`\`\`
## Completed Plans

| Plan Name | Archived At |
|-----------|-------------|
| feature-auth | 2024-01-15 10:30:00 |
| feature-logging | 2024-01-14 15:45:00 |

Total: 2 completed plan(s)
\`\`\`

### Empty Directory Message

If no completed plans exist:
\`\`\`
## Completed Plans

No completed plans found.

Plans are automatically archived here when all tasks are marked complete.
\`\`\`

### Implementation Notes

- Use \`readdirSync\` to read the directory
- Use \`statSync\` to get file modification times
- Sort by modification time (newest first)
- Handle special characters in filenames gracefully

</system-reminder>`
