# Explain the change for review

Use this during [PR preparation](pr.md#show-the-change) when the reviewer needs to understand changed logic, responsibilities, states or interactions. It adapts the visual explanation approach of HumanLayer's [show-me](https://github.com/humanlayer/skills/blob/ca7c8088db69e315a8b2deea43820270457f8f3c/plugins/show-me/skills/show-me/SKILL.md) to astack's source, proof and PR boundaries. The guidance is packaged here; using it does not require installing that plugin or invoking another skill.

## Choose a useful view

Start from the reviewer's question and the completed diff. Usually one view suffices; use another only for a distinct question. Keep names and boundaries concrete and put the view beside the short explanation it supports.

| Review question | Useful view |
| --- | --- |
| Which conditions or operations changed? | Short pseudocode or a focused before/after logic sketch. |
| In what order do calls occur, and who owns the effect? | A shallow call tree, with async or conditional steps made explicit. |
| Where do component state and host adapters belong? | A component tree showing relevant state and module boundaries. |
| What responsibility moved in a refactor? | A shallow file tree or before/after responsibility sketch. |
| How do actors, services or states interact? | A Mermaid sequence, flow or state diagram. |
| What changes inside a familiar structure? | A small `diff` sketch; show the whole target shape if omissions hide ownership or ordering. |
| Is the layout or comparison too dense for those views? | One focused HTML illustration, using the project's visual conventions and real labels. |

A small copy correction normally needs no additional view. A documentation change may benefit from a workflow sketch; being documentation-only does not make a diagram mandatory or useless. Screenshots already captured during proof can explain a UI change without a second illustration. Do not generate every format or reproduce the entire code diff.

## Ground it in the source

Read the changed code and affected consumers before sketching. Use actual paths, symbols, actors and case IDs, with source links where they help the reviewer verify a material claim. Describe the committed shape; label a proposed alternative, abstraction or unknown explicitly. Do not invent an API, call order, state owner or successful outcome to make the view look complete.

A before/after view should isolate the material change while retaining the context that explains its effect. For example, a permissions sketch must include the boundary that makes the decision, not only the client that requests it. A call tree alone may hide concurrency; use a sequence diagram or a short annotation when that distinction matters.

## Make the PR self-contained

Prefer fenced text, `diff` or Mermaid in the PR body so the reviewer can read the explanation there. Give a diagram a short accompanying sentence that conveys the key relationship even when rendering is unavailable. Check that labels, links and the posted view remain understandable at the PR destination; a raw diagram fallback or broken media link needs correction.

When an HTML artifact adds value, render and inspect it locally using the available browser or artifact tools, then show it to the owner. GitHub does not render arbitrary HTML attachments as a live page: include a selected static capture or an accessible artifact link in the PR with a concise text equivalent. Do not put a local filesystem URL in the PR or publish a new website merely to host an explanation. If rendering/tools are unavailable, use a simpler text view and report the missing inspection rather than claiming it rendered. Any illustrative capture is labeled as an illustration, not a product screenshot.

Keep the view current when the diff or relevant revision changes. Put useful retained artifacts with the feature's `.astack/` evidence and keep full generation/runner output ignored locally or in CI. Use the existing [media and evidence policy](proof.md#keep-review-evidence-proportional) for what to retain.

## Keep explanation and proof separate

The view helps a reviewer understand the change. Acceptance still depends on checks and actual observations tied to a revision, environment and case. A rendered illustration can establish that the illustration renders; it cannot establish persistence, permissions, host integration or execution of the depicted path. Cite the relevant proof result separately and keep failed, partial or unavailable observations visible. The visual does not grant merge, release or external messaging authority.
