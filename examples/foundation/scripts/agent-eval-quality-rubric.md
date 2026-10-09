# Craftsmanship rubric

Assess applicable dimensions separately from functional acceptance. Use the original request and project constraints; exclude inapplicable dimensions with a reason.

| Dimension | Evidence to seek |
| --- | --- |
| Types and boundaries | Invalid states excluded; external data parsed into domain values; cases exhaustive; transport details contained. |
| Ownership and effects | One authoritative owner for state; updates atomic where required; lifetime and cancellation explicit; consumers consistent. |
| Simplicity and readability | A direct path from user intent to implementation; needless branches, duplicate representations and forwarding layers removed. |
| Test strength | A real consumer seam, literal expected effects, meaningful rejected cases and a regression that rejects the original or a plausible wrong implementation. |
| Scope and changeability | Required callers migrate together; obsolete paths are removed; a future small change can be made without learning hidden rules. |

For a controlled evaluation use 0 = incorrect/absent, 1 = material gap, 2 = adequate, 3 = strong with concrete evidence. Cite code and checks for each score. A single combined average hides the distinction between a correct but costly design and a clean implementation with a critical defect.

Look first for a representation that deletes complexity. Splitting one complex function into many thin wrappers can increase reader load without fixing ownership. File size, line count, abstraction count and skill reads do not earn quality points by themselves.

Correctness, authorization and material data integrity are hard acceptance gates. A high craftsmanship grade cannot compensate for a failed gate. Conversely, behavior passing does not establish maintainability. For a fresh-agent follow-up, observe its regressions, corrective interventions and effort alongside the delivered diff.

Calibrate evaluation reviewers on anonymized, human-adjudicated good and defective examples. Measure false passes and useful finding precision, shuffle presentation order, and adjudicate disagreements. Preserve grader/rubric versions and changes. Before candidate grading, predeclare the control coverage/sample and qualification rule: which missed critical defects or false passes disqualify the reviewer, the acceptable useful-finding precision, and how the owner adjudicates disagreement. Insufficient or unsuccessful calibration leaves quality unassessed. Calibration and independent grading must meet that rule before a quality verdict is trusted.
