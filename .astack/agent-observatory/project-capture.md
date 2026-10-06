# Project capture

Owner-approved outcome: Observatory captures all runs belonging to explicitly enrolled projects and groups reports by project. The shared service remains on Otis; project identity spans machines, clones and worktrees.

- P1: Owner can create, edit and pause a named project with repository identities and optional machine-specific folders. Anonymous/wrong-owner writes are denied. Pause retains history.
- P2: Collector resolves project from thread metadata before requesting full turns. Disabled, unmatched and ambiguous matches are skipped. A successful policy refresh replaces the local policy; offline collection uses the last accepted policy, and a new machine with no policy captures nothing.
- P3: Ingestion independently checks enabled project membership and machine identity, including event parent runs. Existing excluded queue entries cannot be forwarded. Hooks/manual annotations respect the same boundary.
- P4: Repository normalization matches SSH/HTTPS identities, clones/worktrees and machine-specific folder boundaries. Conflicting evidence never guesses a project.
- P5: Project selector scopes Runs, Work, Skills and Problems and their drill-downs. Global reports contain registered projects only; work IDs from different projects stay separate. Skill totals remain correct across replay and reassignment.
- P6: Bounded, repeatable history migration assigns only reliable metadata matches. Unmatched records remain stored and outside reports. Adding a project replays available source history; no source or existing telemetry is deleted.

Use the existing light/dark design and navigation/table/form patterns. Pen is skipped because visual direction and layout are already agreed; isolated Storybook states cover the project selector, registration, paused/empty/error states and narrow layout. Native Convex tests, collector regressions and deployed owner/machine checks establish persistence and capture boundaries. Astack is enrolled first; other projects require owner registration. Retained captures use fixtures only.

## Dynamic worktree fallback, 2026-10-06

- G1: When native origin metadata is absent, resolve the repository using local Git configuration before requesting full turns. Follow Git's shared worktree configuration; future worktrees need no individual folder registration.
- G2: Preserve non-empty native origin metadata, including conflicting/unregistered identities. The recovered canonical repository travels with the run so backend membership and queued replay use the same evidence. Label it as a capture-time local observation, without inventing historical branch/commit metadata.
- G3: Ignore inherited Git overrides and global/system/included configuration. Bound lookup time/output and withhold command diagnostics. Missing Git/folders/origins and invalid repositories yield no inferred repository; folder policy may still explicitly match. Disabled, ambiguous and unregistered projects remain excluded. Cache lookups only within a poll.
- G4: Trusted hooks use the same local fallback before persisting observations. Existing identities/history remain intact; reset checkpoints during the Otis rollout to reconsider available previously skipped conversations.

Validate with real temporary repositories and detached worktrees outside any registered folder, deliberate missing/conflicting RPC metadata, local queue replay through HTTP/native Convex ingestion and fresh scoped reads, early hooks and a blocking Git configuration. Pen/Storybook are skipped for this collector-only change; no UI or server contract changes are needed.
