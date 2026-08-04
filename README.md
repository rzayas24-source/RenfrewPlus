# Renfrew Workflow

This repo is organized so the backend and frontend can move with the same folder tree.

## Config

- `Script/config.json` is the primary runtime config.
- `workflow_root`, `db_path`, and the folder entries under `ui.sources` control the main file locations.
- `tooling.poppler_bins` and `tooling.fonts` control PDF/image helper paths.
- Set `WORKFLOW_CONFIG_PATH` if you want the backend to read config from a different file path.

## Backend

The API is a FastAPI app in `Script/api.py`.

Example local start command:

```powershell
python -m uvicorn api:app --app-dir Script --host 0.0.0.0 --port 8001
```

Cross-platform launcher:

```powershell
python Start-WorkflowBackend.py
```

Or use the helper script:

```powershell
.\Start-WorkflowBackend.ps1
```

On Linux or macOS:

```bash
chmod +x Start-WorkflowBackend.sh
./Start-WorkflowBackend.sh
```

If you deploy to another machine, update `Script/config.json` so `workflow_root` and the folder paths point at that server's layout.
If you store config somewhere else, point `WORKFLOW_CONFIG_PATH` at that file before starting the API.

## Frontend

The frontend uses Vite.

Example local start:

```powershell
cd Frontend
npm install
npm run dev
```

Use `Frontend/.env.example` as a guide if you need a different dev host, port, or API proxy target.

To build the frontend and package optional runtime assets:

```powershell
python build.py
```

If you prefer PowerShell on Windows, you can still run:

```powershell
.\build.ps1
```

## Portable Paths

The screens that show source folders now read from config instead of hardcoding machine-specific absolute paths.
The snapshot helper also prefers configured or bundled tool paths before falling back to local defaults.
The repo-level portability playbook lives in [PORTABILITY_PLAYBOOK.md](/C:/Renfrew/Workflow/PORTABILITY_PLAYBOOK.md).

## Windows-Only Pieces

- `Script/site_emaildownloader.py` uses Outlook COM automation, so that downloader only runs on Windows with Outlook installed.
- The bundled Poppler tree is a Windows convenience copy for PDF rendering; on other systems, provide matching `pdftotext`/`pdftohtml`/`pdfinfo` binaries through config if you want PDF search and snapshots.
