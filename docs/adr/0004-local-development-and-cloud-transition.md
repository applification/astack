# 0004 — Local development and user-initiated cloud transition

Status: accepted. Owner instruction: 5 October 2026 in this chat.

New apps start with persistent local development, including local Convex. The user decides whether an app is worth proceeding with and when it should move to cloud or be hosted externally. Provisioning an auth sandbox or needing a public integration URL does not decide that transition. Existing apps preserve their accepted deployment until a transition is requested.

Ordinary development preserves data across shutdown/restart. Disposable readiness remains separate and cleans up only its own fixtures. The foundation guards local startup and administrative commands against cloud targets/keys and derives the clients' actual local backend URL. Real login still uses WorkOS; local signed proof identities do not become hosted users.

“Move this app to cloud” is an astack delivery workflow. It resolves the actual project/deployment/frontend host and empty-versus-transfer decision, preserves local configuration and backups, updates frontend/WorkOS/MCP settings, deploys the chosen target, verifies actual hosted behavior and retains recovery. It remains inside astack's remit. Hosted proof must be observed during the requested transition; implementing this workflow does not itself deploy or prove a cloud instance.

This extends [0001](0001-foundation-profile.md)'s core profile and separates persistent development from its disposable verification environment. Workflow guidance lives in [cloud transition](../../plugins/applification/skills/cloud-transition/SKILL.md); generated projects carry `.astack/cloud.md` with reference-specific commands.
