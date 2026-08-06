# Portability Playbook

This repo is already in a better place than before, but the move from a work laptop to a server goes best in phases. The main goal is to remove hidden machine assumptions without breaking the current local setup.

## Phase 1: Baseline The Laptop

- Capture the current config in `Script/config.json`.
- Verify the canonical launch paths still work on the laptop.
- Record the current database and storage locations.
- Confirm the laptop has a usable backup before changing anything.

## Phase 2: Make Storage Server-Ready

- Keep the database location fully configurable.
- Keep emails, EDI, HTML, snapshots, and imports externally configurable.
- Decide which folders become server-mounted shares versus local disk.
- Verify paths resolve from config instead of code.

## Phase 3: Harden Auth And Sessions

- Review the login and role flow in the backend.
- Define idle timeout and session behavior.
- Confirm audit logging expectations for sign-in and role changes.
- Keep the security boundary independent of the laptop trust model.

## Phase 4: Separate Portable Core From Windows-Only Pieces

- Keep Outlook COM automation explicitly marked as Windows-only.
- Treat bundled Poppler as a convenience, not a hidden requirement.
- Add capability checks for optional tooling.
- Make the portable core work without the laptop-specific helpers.

## Phase 5: Pilot And Cut Over

- Stand up a test server with the same config structure.
- Point the app at server storage and the server database.
- Run login, attachments, snapshots, worklists, and imports end to end.
- Test backup and restore before cutover, then switch daily use.

## VPN Readiness Plan

- Confirm whether Codex is running locally on the laptop, on a remote host, or through a remote connection before debugging VPN issues.
- Separate `localhost` checks from external-network checks. A passing local test does not prove the VPN path is healthy.
- After connecting the VPN, wait for the route and DNS state to settle before testing again. If connectivity works briefly and then drops, treat that as a VPN policy or routing change, not a Codex code issue.
- Verify whether the VPN preserves access to the backend port, required external APIs, and any SSH or remote-host connection used by Codex.
- If the VPN changes behavior after initial connect, document the exact delay, hostname, port, and failure mode so we can reproduce it on demand.
- Prefer split tunneling or an allowlist for the minimum hosts Codex needs when the VPN is required for development.

## Quick Wins

- Keep paths in `Script/config.json` and avoid hardcoded absolute folders.
- Use `python build.py` and `python Start-WorkflowBackend.py` as the canonical entrypoints.
- Keep PowerShell and bash helpers as wrappers, not the primary path.
- Use explicit locale formatting like `en-US` when the UI expects US dates or currency.
- Keep browser-held workflow state out of `localStorage` when the data matters beyond one machine.
- Prefer `Path`, `resolve_path`, and relative paths over manual string joins.
- Document any platform-specific dependency instead of letting it look universal.
- Treat VPN behavior as a portability variable: `localhost` may still work briefly after connect, then routing or DNS can change and break external calls.

## Medium Fixes

- Push more storage targets into config, especially anything involving the database, file shares, or snapshots.
- Keep the backend and frontend separately deployable so one can move without the other.
- Add capability checks for optional tooling such as Poppler instead of assuming it is always present.
- Keep auth, role checks, and audit logging server-side so they move with the app.
- Add multi-OS CI or at least build verification on another host when practical.
- Formalize backup, retention, and recovery expectations that the app relies on.

## Intentional Windows-Only Exceptions

- `Script/site_emaildownloader.py` uses Outlook COM automation.
- Bundled Windows Poppler is a convenience for PDF rendering on Windows.
- `.ps1` scripts remain as convenience wrappers for Windows operators.
- Any future integration that depends on a Windows desktop app, COM automation, or a Windows-only vendor tool should be called out explicitly.

## Rule Of Thumb

If a feature depends on one workstation, one shell, or one operating system, make that dependency explicit and optional whenever possible.
If a feature depends on stable network routing, document whether VPNs, split tunneling, or DNS changes can affect it, because local-only tests can pass while real connectivity still drops.
