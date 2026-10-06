# Agent observability language

| Term                  | Meaning                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Project               | An owner-enrolled body of work whose related conversations belong together across computers and checkouts. |
| Capture policy        | The owner's selection of projects whose conversations may be observed.                                    |
| Work reference        | Identity of work owned by another system; optional parent context for one or more runs.                   |
| Session               | A conversation that can contain multiple execution attempts.                                              |
| Run                   | A bounded agent attempt to perform work, with or without a work reference.                                |
| Event                 | An observed action, result or lifecycle fact belonging to a run.                                          |
| Outcome               | The assessed result of the engineering work, distinct from agent completion.                              |
| Intervention          | An explicit human interruption or intervention; an ordinary prompt is not sufficient evidence.            |
| Capability use        | Evidence that a skill, instruction or workflow was read, explicitly supplied, or declared for an attempt. |
| Observation-time hash | Identity of capability content when it was inspected, without proof of its historical identity.           |
| Use-time hash         | Identity captured at the capability's use observation, with the observation's provenance.                 |
| Finding               | A deterministic signal with supporting observations; not a causal conclusion.                             |
