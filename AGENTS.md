<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from training data.

Before writing or modifying Next.js code:

1. Read the relevant guide in `node_modules/next/dist/docs/`.
2. Follow the repository's installed Next.js version rather than remembered framework behavior.
3. Heed deprecation notices.
4. Do not assume an API, convention, route structure, or configuration is valid without checking the installed documentation.
<!-- END:nextjs-agent-rules -->

# CEYLİN ERP → ENVERP — Repository Agent Entry Point

## Mandatory first read

Before analyzing, editing, testing, reviewing, refactoring, or documenting this repository, read:

1. `docs/architecture/assistant-workflow.md`
2. The current project handoff/devir note
3. The relevant canonical architecture and contract documents
4. The current ordered work list
5. For Next.js work, the relevant installed guide under `node_modules/next/dist/docs/`

The rules in `docs/architecture/assistant-workflow.md` are mandatory for Codex, ChatGPT, Gravity, and any other assistant working in this repository.

## Non-negotiable execution rules

- Apply Red Team, Truth Mode, and Future Me to every task and report.
- Do not create commits.
- Do not push.
- Do not deploy.
- Do not silently change canonical models or contracts.
- Do not treat self-authored tests as independent proof.
- Report every assumption, unresolved point, changed file, command, and exit code.
- A separate PowerShell evidence report is required before commit approval.
- Commit, push, and deploy require separate explicit approval from the project owner.
- The words `devam` and `peki` mean continue working; they are not approval.
- `PAK` means a step or test passed; it is not commit, push, or deploy permission.

## Role boundaries

### Codex

May analyze, implement, refactor, test, and propose a commit scope.

Must not:

- Commit
- Push
- Deploy
- Silently alter canonical contracts
- Treat its own tests as independent proof

### ChatGPT + PowerShell

Performs:

- Independent verification
- Contract comparison
- Risk review
- Evidence reporting
- Commit scope validation
- Approved Git command preparation

### Gravity

Handles:

- UI layout
- Visual reports
- Buttons and modal design
- Responsive behavior
- User experience

Must not rewrite:

- Finance logic
- Authorization logic
- Sync logic
- Ledger rules
- Canonical domain models

## Required completion report

Every delivery must include:

- RED TEAM SONUCU
- TRUTH MODE SONUCU
- FUTURE ME SONUCU
- ETİK KURAL İHLALİ
- KESİNLEŞMEMİŞ NOKTALAR
- UZUN VADELİ ETKİ
- DEĞİŞEN DOSYALAR
- ÇALIŞTIRILAN KOMUTLAR VE EXIT CODE
- SOURCE / STAGE / COMMIT / PUSH / DEPLOY STATUS
- NİHAİ HÜKÜM

Do not declare work complete or safe without evidence.
