# Agent observability language

| Term                  | Meaning                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| Project               | An owner-enrolled body of work whose related conversations belong together across computers and checkouts. |
| Capture policy        | The owner's selection of projects whose conversations may be observed.                                     |
| Work reference        | Identity of work owned by another system; optional parent context for one or more runs.                    |
| Session               | A conversation that can contain multiple execution attempts.                                               |
| Provider              | The agent system that executes a turn; a model is the selected model within that system.                   |
| Provider turn         | One provider's bounded execution within a conversation.                                                    |
| T3 run                | A T3 orchestration request that may contain several provider turns or attempts.                            |
| Capture source        | The system from which a conversation's recorded observations are read.                                     |
| Run                   | A bounded agent attempt to perform work, with or without a work reference.                                 |
| Event                 | An observed action, result or lifecycle fact belonging to a run.                                           |
| Outcome               | The assessed result of the engineering work, distinct from agent completion.                               |
| Evaluation            | The intended work, acceptance and evidence against which agent behavior and delivery are assessed.         |
| Assessment            | A judgment against stated criteria, with reasons and supporting observations.                              |
| Outcome feedback      | The owner's view of whether a result delivered what they wanted, independently of technical grades.        |
| Verification report   | Reported observations of acceptance cases on a named revision and environment, with retained evidence.     |
| Astack route          | The engineering approach explicitly selected for the requested outcome, with a recorded reason.            |
| Workflow flow         | Capture-owned correlation of a route selection, changes and phase transitions across linked turns.         |
| Workflow phase        | An agent-declared part of its approach, whose progress and skill application need supporting observations. |
| Delegation            | An agent assigning a distinct task to a child agent, separately from forking a conversation.               |
| Agent branch          | A delegated child's own journey, observations and execution attempts within the parent task.               |
| Workflow join         | The parent's explicit record of using identified child results in its continuing work.                     |
| Flow assessment       | An owner's evidence-backed judgment of route choice and execution, independent of outcome assessment.      |
| Intervention          | An explicit human interruption or intervention; an ordinary prompt is not sufficient evidence.             |
| Capability use        | Evidence that a skill, instruction or workflow was read, explicitly supplied, or declared for an attempt.  |
| Observation-time hash | Identity of capability content when it was inspected, without proof of its historical identity.            |
| Use-time hash         | Identity captured at the capability's use observation, with the observation's provenance.                  |
| Finding               | A deterministic signal with supporting observations; not a causal conclusion.                              |
