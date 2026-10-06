# Dave Hudson’s MacBook setup

Otis is ready; **nothing has been installed on the MacBook**. Run these steps there when convenient. The collector runs independently after installation and needs no web app or Convex server on the MacBook.

1. Connect Tailscale and install Bun plus Codex CLI. Use Codex 0.160.0 or a compatible newer app-server; `codex --version` identifies the CLI the collector will read. Clone/update this Astack branch (or main after merge), then enter the repository.

2. Build and install locally for the MacBook’s CPU:

   ```sh
   bun install --frozen-lockfile
   bun infra/observatory/install-collector.ts \
     --endpoint https://otis.tail12a0a0.ts.net:8452/agentlog/ingest \
     --name "Dave Hudson's MacBook"
   ```

   This creates a fresh stable machine UUID and random ingestion key in `~/.agentlog`, signs the compiled binary, and starts a user LaunchAgent. It resolves the absolute Codex executable path. Before machine enrollment, it cannot fetch a project policy and captures no turns. Keep the existing state when reinstalling so this machine keeps its identity.

3. Copy **`~/.agentlog/enrollment.json`** to Otis via your normal private file-transfer method. It contains the machine UUID/name and a SHA-256 credential hash, **not the ingestion key**. Keep `ingest-token` on the MacBook.

4. On Otis, from the Astack checkout used for deployment, register that file:

   ```sh
   bun infra/observatory/register-machine.ts /path/to/macbook-enrollment.json
   ```

   The command retains existing machine credentials and updates the private Convex configuration. Do not paste keys into chats, commit them, or reuse Otis’s ingestion key on another machine.

5. Open [Projects](https://otis.tail12a0a0.ts.net:8450/#projects). Astack's existing repository enrollment covers MacBook clones and worktrees when their Codex thread metadata includes that Git origin. Enroll other repositories you want to observe. For a non-Git project or missing origin metadata, edit its project and add its absolute MacBook folder using **Dave Hudson's MacBook** in the Computer selector. Register the machine first so it appears even before its first captured run.

6. On the MacBook, check capture and forwarding:

   ```sh
   "$HOME/.local/share/astack/observatory/bin/agentlog" status
   launchctl print "gui/$(id -u)/net.applification.astack-agentlog"
   ```

   Project policy, source health and forwarding should become `ok`; matching historical runs drain in bounded batches. Open [Observatory](https://otis.tail12a0a0.ts.net:8450) over Tailscale, select a project and filter runs by the machine UUID printed at installation. All available history matching enabled projects is included unless you set a later `since` in config. Unregistered and ambiguous conversations are excluded. After its first policy fetch, an offline MacBook uses the last accepted policy until it reconnects.

## Codex desktop and T3 Code homes

The default is `CODEX_HOME` or `~/.codex`. If desktop/CLI/T3 uses another home, edit `~/.agentlog/config.json` and add its absolute path to `homes`. Read T3's provider settings to find its selected home; do not assume a shadow home is the default. New collectors capture readable content with mandatory secret redaction. Use `agentlog content off` and restart the collector for metadata-only capture. The dashboard's Show content toggle separately hides captured details on screen.

```json
"homes": [
  {"path": "/Users/YOUR_USER/.codex", "label": "desktop-and-cli"},
  {"path": "/absolute/path/to/t3-codex-home", "label": "t3"}
]
```

Restart after changing configuration:

```sh
launchctl kickstart -k "gui/$(id -u)/net.applification.astack-agentlog"
```

Only configure real homes. If two paths refer to the same sessions, stable run/event identities deduplicate them. The collector's passive reader never resumes your agent turns.

For a convenient command, add `~/.local/share/astack/observatory/bin` to your shell's PATH, or use the absolute binary path above. Optional trusted hooks and future work correlation are described in the [main guide](agent-observatory.md).

To stop capture without deleting data:

```sh
launchctl bootout "gui/$(id -u)/net.applification.astack-agentlog"
```

Reinstall supervision with `agentlog service --executable "$HOME/.local/share/astack/observatory/bin/agentlog"`. Preserve `~/.agentlog` for subsequent reinstalls.
