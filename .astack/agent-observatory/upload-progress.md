# Current conversations and historical uploads

An active T3 turn had 169 redacted events locally but zero in Convex: historical uploads held its details behind an already visible run summary. Older T3 turns had complete traces. The change applies to all captured clients.

- RECENT: Recent turns upload their summary and details before older turns. Every fourth batch uses the oldest queue order so historical records continue under sustained new activity.
- DRAIN: A single independent uploader drains bounded batches without waiting for the capture polling cycle. Failed requests retain revisions, back off, and retry. Capture continues during network waits; shutdown cancels the request before closing the local store. Operator `--once` keeps its existing 20-batch bound.
- PROGRESS: An exhausted trace reports the exact uploaded count against the captured count, including zero/partial/complete states. While more pages exist, show a lower bound and the loaded count; never treat pagination or an active filter as missing uploads. Initial loading and a temporarily lagging summary stay distinct.
- PRIVACY: Existing redaction, project allowlisting, record/byte budgets, authentication and revision acknowledgements remain in force. No production trace content is retained in evidence.

Pen is skipped: the change reuses the agreed trace layout and existing notice styles. Storybook is selected for waiting, partial, paginated, checking and complete states in light/dark and narrow layouts. Real SQLite/HTTP queue checks establish priority, historical fairness, independent draining, retry and concurrent updates. Authenticated native reads and a deployed UI check establish Otis delivery separately.
