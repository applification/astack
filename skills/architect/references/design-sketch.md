# A useful design sketch

Keep the sketch proportional to the decision. A small interface can be a usage example and a few signatures. A larger change can add an ownership map. Reuse the project's existing types and decision record.

1. **Usage.** Write the call as a consumer should use it, including the result and error cases the consumer must handle.
2. **Shape.** Sketch domain types, function signatures and the module that owns each effect. Leave bodies empty or use pseudocode.
3. **Invariants.** Name the state combinations that are impossible, the authoritative data source and the validation boundary.
4. **Choice.** Where there is a real tradeoff, compare a different shape and explain why the chosen one has less coupling or better recovery. Record a consequential decision in the existing ADR register.
5. **Proof.** Name the observable cases that would distinguish the chosen design from a plausible wrong implementation.

For example, a retryable export needs a caller-visible operation identity and status, an owner for durable progress, and a cancellation result. A bag of optional fields such as `finished`, `error`, `progress` and `file` can admit contradictory states. Sketch distinct running, completed and failed states and identify the transition that owns each durable write. Prove retry/interruption behavior against fresh persistent reads.

Review the sketch for unnecessary forwarding layers, duplicated state, framework types crossing a domain boundary, and callers that must know private sequencing rules. Count lines or modules only as diagnostics; judge the reader's work and the supported behavior.

When constraints change, update the sketch and affected acceptance explicitly. Repeated casts, silent fallbacks or special cases can indicate a wrong representation. A single legitimate edge case does not require redesigning the whole system.
