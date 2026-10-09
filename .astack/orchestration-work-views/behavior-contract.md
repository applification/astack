# Orchestration work views

The owner wants to inspect a real implementation of the agreed Work story and
Graph views on Observatory evaluation/task detail. Both views describe captured
work and share selection and evidence. A child conversation stays separate;
returned results and explicit parent use have distinct connections.

## Acceptance

- W1: Work story is the default. Switching to Graph and back preserves the
  selected contribution and its trace/evidence links.
- W2: Parent phases, retries, skill reads and delegated contributions are
  inspectable. Separate dispatches are placed in recorded order rather than
  beneath one shared fork. Unknown timing is labelled rather than invented.
- W3: Completed task, result present in parent capture, host delivery, terminal
  acknowledgement and parent-declared use are independent facts. Completion
  creates no return/use edge. A join whose
  evidence is unavailable says use was declared and explains the coverage gap.
- W4: Supported host result observations survive native/T3 overlap without
  replacing canonical native trace events, assessed outcomes or immutable
  evaluation evidence. A null result supplies no presence fact; delivery or
  acknowledgement requires an explicit host classification.
- W5: Keyboard selection, view switching and focus work; mobile has no document
  overflow. The graph permits local panning and detailed content can wrap.
- W6: Indexed, bounded reads retain project/machine/readability checks and expose
  truncation. Automatically discovered children remain outside grading evidence.

## Design and scope

The two synthetic HTML prototypes reviewed in this thread are the chosen visual
direction: compact work story and a parent spine with child result connections.
Pen is not selected: the owner asked to build and inspect this accepted direction
in the product; another design round would not resolve a remaining decision.
Storybook is selected for explicit joins, missing evidence, returned results,
retries, multiple children, keyboard state and narrow-layout regressions.

Use existing React, SVG and Convex contracts. Graph libraries are not required
for this bounded view. Host transport delivery/acknowledgement is only claimed
if the available host contract actually supplies it; a result stored in the
parent capture has that narrower label. Preserve existing authentication and
evaluation grading. No cloud/production deployment or data migration is part of
this local implementation and review.

## Proof

[Observed proof](evidence/report.md) maps these cases to domain/collector/native
Convex tests, UI lint/build, Storybook browser observations, local backend
verification, independent review and retained synthetic screenshots. Synthetic
presentation proof, persisted adapter proof and private live behavior are
reported separately.
