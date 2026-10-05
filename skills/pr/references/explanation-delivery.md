# Deliver an explanation in a PR

Use [show-me](../../show-me/SKILL.md) for the explanation itself. This reference owns its delivery at the PR destination.

Prefer fenced text, `diff` or Mermaid in the PR body so a reviewer can read the view there. Include a short text equivalent. Inspect the posted view for readable labels, correct source links and usable rendering; correct broken media or raw-diagram fallbacks.

For an HTML illustration, render and inspect it locally and show it to the owner. GitHub does not display arbitrary HTML as a live page: retain a selected capture or an accessible artifact link with a text equivalent. A local filesystem URL cannot serve as a shared PR artifact. Do not publish another website just to host the explanation. If rendering is unavailable, use a simpler view and name the limit.

Refresh the view when the diff changes. Label proposals and illustrations explicitly. Use [evidence retention](../../verify/references/proof-policy.md#keep-review-evidence-proportional) for selected artifacts; full output stays ignored or in CI. Explain the change beside its proof summary, without treating the illustration as an observation of execution.
