# Source

Third-party skill, installed at the owner's request on 2026-10-13.

- Repository: https://github.com/nateherkai/scroll-craft
- Path in repository: `plugins/nateherk-design/skills/scroll-craft/`
- Version 0.3.1, commit `75d81f74e83692add18cd7a8a8e078b8a887a579` (2026-09-30)
- Licence: MIT, copyright Nate Herk (see `LICENSE`)

The folder is an unmodified copy apart from this file and the licence. To
update, replace it with the same path from a newer commit and change the line
above. `scripts/kie.mjs` calls kie.ai and needs `KIE_AI_API_KEY`; Learli does
not set one, so nothing here makes a network request unless a key is added.
