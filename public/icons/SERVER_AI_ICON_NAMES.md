# Icon Name List: Server / AI Theme

Icons for representing the additional backend features that need to be started separately from the lighter JS Electron app. These icons signal heavier backend services running on the server side.

---

## 1. Backend Server Icons

| Icon Name | Purpose | Context |
|-----------|---------|---------|
| `server` | Generic backend server indicator | Settings panels, status badges |
| `dns` | Network/server identity (used in BackendServerPanel) | Server configuration card avatar |
| `data_usage` | Backend data processing activity | Health/status indicators |
| `router` | Server routing/network gateway | Connection status display |
| `settings_applications` | Server configuration/settings | Server settings section header |

## 2. AI / Machine Learning Icons

| Icon Name | Purpose | Context |
|-----------|---------|---------|
| `psychology` | AI/ML processing (face recognition, etc.) | AI server status, recognition tasks |
| `smart_toy` | AI assistant/AI features | AI feature indicators |
| `auto_stories` | Neural network/deep learning visualization | AI training, model processing |
| `mood` | Face/emotion analysis (AI output) | Recognition results display |
| `precision_manufacturing` | Automated processing pipeline | Batch recognition tasks |

## 3. Python / Backend Technology Icons

| Icon Name | Purpose | Context |
|-----------|---------|---------|
| `code` | Code execution/backend logic | Backend server status, diagnostics |
| `terminal` | CLI/server console output | Server logs, error messages |
| `build` | Build/compilation process | Migration runs, setup tasks |

## 4. Recognition / Processing Task Icons

| Icon Name | Purpose | Context |
|-----------|---------|---------|
| `face` | Face recognition (Quasar built-in or custom) | Recognition panel headers |
| `photo_library` | Media processing by backend | Gallery recognition tasks |
| `analytics` | Analytics/reporting from AI | Recognition statistics |
| `schedule` | Scheduled/background recognition jobs | Task queue display |
| `hub` | Central processing hub for AI tasks | Overall system architecture view |

## 5. Status / State Indicators

| Icon Name | Purpose | Context |
|-----------|---------|---------|
| `play_circle` | Start server action | Start button icon |
| `stop_circle` | Stop server action | Stop button icon |
| `refresh` | Refresh server status | Status refresh button |
| `sync_problem` | Server connection error | Health check failure |
| `warning_amber` | Server warning/degraded state | Partial health issues |
| `check_circle` | Server healthy/running | Positive health status |

## 6. Storage / Data Backend Icons

| Icon Name | Purpose | Context |
|-----------|---------|---------|
| `storage` | Database/backend storage | Media storage, recognition DB |
| `sd_storage` | External/media storage mounts | Partition mounting UI |
| `folder_special` | Special AI-processed folders | Workspace directory indicators |

---

## Recommended Usage

### For BackendServerPanel (server like theme):
- **Main avatar icon**: `dns` or `server` — indicates a network server service
- **Start button**: `play_circle` — clear action indicator
- **Stop button**: `stop_circle` — clear action indicator
- **Status badge color logic**: green (`check_circle`) = healthy, amber (`warning_amber`) = starting, grey = stopped

### For AI Server (AI like theme):
- **Main avatar icon**: `psychology` or `smart_toy` — indicates intelligent/AI processing
- **Recognition task indicator**: `face` or `analytics`
- **Processing status**: `data_usage` or `hub`

---

## Notes

- Quasar uses Material Design Icons (MDI). All icons listed above should be available in MDI v7+.
- For custom Python/Django branding, consider creating a small SVG icon (`django.svg`, `python.svg`) and placing it in `public/icons/`.
- The key distinction: **`server`/`dns`** for the generic backend server (Python Django), **`psychology`/`smart_toy`** for AI-specific features.