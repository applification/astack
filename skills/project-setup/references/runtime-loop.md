# Establish the runtime control and verification loop

Use this for new-project setup or integration and upgrades in an existing project. Installation supplies the engineering skills; setup establishes their working environment in this repository. Keep runtime commands, selectors, fixtures and product knowledge in the project.

## Inspect and choose the target

Read existing agent instructions and `.astack/project.md`, user surfaces, package scripts, CI, drivers, test fixtures, auth/data environments and the Git publication target. Run a safe existing path when available. Identify which parts already support the loop and which cannot start, identify, drive, inspect or verify the product.

Use these defaults rather than presenting a menu of infrastructure choices:

| Boundary | Default and integration decision |
| --- | --- |
| Task ownership | Install [main-thread orchestration](../../astack/references/orchestration.md) in the project's actual host instructions on new setup and upgrades. The main agent owns integration and proof; delegate when useful with the available host. |
| New product | Apply [new-product defaults](profile.md) for the actual surfaces; add only packages with consumers. Start locally with persistent development data. |
| Existing product | Integrate the loop and upgrade weak or missing development/proof tooling. Reuse working parts; compare proposed stack changes with astack defaults and the product's requirements. |
| Product control | A project-owned executable `astack-<app>` skill/CLI and feature map through [app-control](../../app-control/SKILL.md); adapt an existing driver rather than duplicate it. |
| Web development | Use Portless for new astack-default Vite/Next.js apps and suitable existing-app upgrades; verify the actual checkout URL, proxy and trust. Keep an explicitly selected or equally effective existing launch model. |
| Verification | Fast affected checks plus an exact running-product regression. Use [Tester Army e2e](../../testing/references/e2e.md) for new web setups or a missing verification route; reuse a proven runner and add the identity, fixture and reporting capabilities it lacks. |
| UI work | Establish shadcn lint when shadcn is used; select Pen and Storybook through [web-feature](../../web-feature/SKILL.md) for the actual design/component questions. |
| Work tracking | Use the established tracker. Otherwise use GitHub Issues when deferred work needs a durable owner and next action; setup does not require an issue or label scheme. |

Present the concrete loop to establish and the important upgrades with their reasons. Infer routine defaults from the request and repository; ask only about choices that materially change the product, data or scope. In particular, explain a framework, database or auth migration and its recovery before proceeding when those choices are unresolved. Respect an already supplied stack or migration decision. Model selection and reasoning budgets remain agent-host preferences unless the user asks to configure them.

## Build and exercise the loop

Establish the smallest useful slice: start or connect, diagnose the correct instance, perform one mapped user action, independently inspect its result, capture evidence and clean up. Follow the [control contract](../../app-control/references/control-contract.md) for commands, ownership and the map. Add a meaningful regression at the seam that can catch failure, using [testing](../../testing/SKILL.md). Keep fast edit-time checks and CI aligned with the chosen path.

For an existing project, retain a baseline of the affected behavior before upgrading and rerun it afterwards. Include lockfile, script, CI and project-guidance changes in the same coherent slice when they are coupled. Persistent data or identity changes need a migration/recovery path. A request to add one control command does not by itself authorize unrelated stack replacement. Hosting transitions use [cloud-transition](../../cloud-transition/SKILL.md) when the user chooses them.

For an executable library, exercise a real consumer or example with its normal runtime and appropriate assertions. Record that an app session and browser feature map are not applicable. For several runnable surfaces, select a first path and explicitly record remaining coverage; do not describe one web check as complete MCP or native-host proof.

## Record project-owned guidance

Create or update tracked `.astack/project.md` after real commands and surfaces exist. Preserve custom sections on re-runs, reconcile stale commands against source and observations, and link authoritative configuration rather than duplicating it. Keep commands checkout-relative and worktree URLs dynamically resolved by the control tool. Keep secrets and private data out of the profile.

```markdown
# astack project profile

## Runtime and surfaces
Actual framework/runtime, product entry points, selected astack defaults,
upgrades made or deliberately deferred, and links to their rationale.

## Control loop
Exact startup/connect and doctor commands; how identity and instance ownership
are checked; control skill and feature map paths; safe actor/fixture setup;
one mapped action, independent result inspection and cleanup commands.

## Verification and evidence
Fast affected checks, exact regression and required CI commands;
observed revision/environment and path result; retained evidence location;
what each check proves and any remaining prerequisite or coverage gap.

## Project decisions
Existing glossary/context map and decision register; active behavior contracts;
issue/PR workflow, release rules and actions reserved for the owner.
```

Install concise project-owned orchestration instructions as well as the profile pointer. Codex reads root `AGENTS.md`; Claude Code needs root `CLAUDE.md` with the instructions or an explicit read/import of `AGENTS.md`. For another host, use its actual instruction entry point. Keep an existing working host pointer. Plugin installation alone does not make this repository's root instructions apply to a consuming project, and T3 is not a prerequisite.

For Codex, inspect root `AGENTS.override.md` before choosing the effective entry point: a nonempty override takes precedence over `AGENTS.md`. Reconcile the missing orchestration clauses in that effective file or add an explicit read of shared root guidance, preserving the override's custom instructions. Do not claim adoption from an `AGENTS.md` edit that the host's override would skip. Include an override case when verifying an upgrade.

Read the applicable files before editing. Reconcile equivalent existing clauses rather than adding a second orchestration section. Create a missing root instruction file; on upgrades, add only the missing clauses and refresh stale profile pointers. Preserve custom text, including custom text within an astack section, and keep the project-owned additions outside framework-managed markers. Do not replace the whole file or put these rules into a block regenerated by Next.js, Convex or another tool. A repeated setup with unchanged policy must leave the guidance unchanged. For example:

```markdown
## astack

In every main conversation or standalone session, own the user's task as
orchestrator through completion; children follow their brief and return here.
Keep a proportionate plan and finish conditions. Delegate when useful through
the available host; T3 is optional. Give complete briefs and retain host child
handles. Keep one writer per worktree. Review and integrate child results,
resolve findings, and verify the combined result before claiming completion.
Keep the parent informed of progress, proof and gaps. Preserve supplied work
identity. With readable capture, the owner begins/finishes evaluations; children
return evidence under the owner's evaluation task ID. Reuse that ID for active
follow-ups; materially revised proof after immutable delivery needs a fresh ID.

Read `.astack/project.md` for runtime, control and verification commands.
Use `$applification:astack` to route work or invoke a focused skill directly.
```

The installed [orchestration reference](../../astack/references/orchestration.md) owns host lifecycle detail; keep that detail in the plugin instead of copying it into every project. Confirm the actual host instruction entry point reaches the root instructions and profile without absolute worktree paths or dependencies on this source checkout. Do not edit user-global config or installed caches to establish project guidance. Report host loading as unverified if only the files were inspected.

Follow existing glossary/context maps and decision registers; use [domain-modeling](../../domain-modeling/SKILL.md) when terms actually need resolving. Setup does not need empty glossary or ADR files. Check that the profile, control skill and map are visible to Git. Feature contracts and decisive review evidence live under tracked `.astack/<feature>/`; full temporary run directories remain ignored.

## Acceptance and resumption

Exercise the documented loop from the checkout, including direct invocation and `--help`, instance diagnosis, the mapped action, fresh result inspection, meaningful checks and owned cleanup. Verify retained evidence still exists after cleanup. Inspect the root host instructions/profile links and re-run the guidance update to verify preservation and idempotence. Separate that scaffold proof from a real host session's observed loading/behavior. Use [verify](../../verify/SKILL.md) to record actual observations and limits; use [pr](../../pr/SKILL.md) to finish kept changes.

If a prerequisite prevents startup, auth, action or observation, mark the affected setup partial and name the exact next action. Complete independent work and preserve the first failure. If follow-up tracking is useful and issue creation is authorized, record that prerequisite in GitHub or the existing tracker; a ticket does not substitute for observed proof. Re-running setup resumes gaps and refreshes stale guidance instead of creating a second loop.
