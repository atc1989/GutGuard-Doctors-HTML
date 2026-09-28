# Workspace Execution Rules

- **Code Style & Judgment**: Match the surrounding code's idioms, naming patterns, and comment density. Do not rewrite full files—prefer concise line diffs.
- **Direct Output**: Skip conversational openers, polite closings, and conversational summaries. Return directly to code or answers.
- **Progressive Context**: Load context on demand. Search for specific symbols or line numbers before inspecting complete files. Reference sub-files in `/docs` only when working on those specific components.
