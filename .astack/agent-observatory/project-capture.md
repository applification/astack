# Project capture

Owner-approved outcome: Observatory captures all runs belonging to explicitly enrolled projects and groups reports by project. The shared service remains on Otis; project identity spans machines, clones and worktrees.

- P1: Owner can create, edit and pause a named project with repository identities and optional machine-specific folders. Anonymous/wrong-owner writes are denied. Pause retains history.
- P2: Collector resolves project from thread metadata before requesting full turns. Disabled, unmatched and ambiguous matches are skipped. A successful policy refresh replaces the local policy; offline collection uses the last accepted policy, and a new machine with no policy captures nothing.
- P3: Ingestion independently checks enabled project membership and machine identity, including event parent runs. Existing excluded queue entries cannot be forwarded. Hooks/manual annotations respect the same boundary.
- P4: Repository normalization matches SSH/HTTPS identities, clones/worktrees and machine-specific folder boundaries. Conflicting evidence never guesses a project.
- P5: Project selector scopes Runs, Work, Skills and Problems and their drill-downs. Global reports contain registered projects only; work IDs from different projects stay separate. Skill totals remain correct across replay and reassignment.
- P6: Bounded, repeatable history migration assigns only reliable metadata matches. Unmatched records remain stored and outside reports. Adding a project replays available source history; no source or existing telemetry is deleted.

Use the existing light/dark design and navigation/table/form patterns. Pen is skipped because visual direction and layout are already agreed; isolated Storybook states cover the project selector, registration, paused/empty/error states and narrow layout. Native Convex tests, collector regressions and deployed owner/machine checks establish persistence and capture boundaries. Astack is enrolled first; other projects require owner registration. Retained captures use fixtures only.
