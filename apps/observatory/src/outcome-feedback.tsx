import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Button } from "@astack/ui";
import {
  outcomeFeedbackInputSchema,
  type OutcomeFeedbackInput,
} from "@astack/agent-observability/evaluations";
import { feedbackLabels } from "./evaluation-evidence";

export function OutcomeFeedbackForm({
  save,
}: {
  save: (feedback: OutcomeFeedbackInput, requestId: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const request = useRef<{ content: string; id: string } | null>(null);
  const form = useForm({
    defaultValues: { choice: "", comment: "" },
    onSubmit: async ({ value }) => {
      setError("");
      setSaved(false);
      const parsed = outcomeFeedbackInputSchema.safeParse(value);
      if (!parsed.success) {
        setError("Choose how well this delivered what you wanted.");
        return;
      }
      const content = JSON.stringify(parsed.data);
      if (request.current?.content !== content)
        request.current = { content, id: crypto.randomUUID() };
      try {
        await save(parsed.data, request.current.id);
        setSaved(true);
      } catch {
        setError(
          "Your review could not be saved. Your answers are still here; please retry.",
        );
      }
    },
  });
  return (
    <form
      className="project-form evaluation-feedback"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2>Did this deliver what you wanted?</h2>
      <p className="subtitle">
        Your view of the result. You can review intent and skills in more detail
        below.
      </p>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="choice">
              {(field) => (
                <fieldset disabled={pending} className="min-w-0">
                  <legend className="sr-only">Your view of the result</legend>
                  <div className="evaluation-choices">
                    {Object.entries(feedbackLabels).map(([choice, name]) => (
                      <Button
                        key={choice}
                        type="button"
                        variant={
                          field.state.value === choice ? "default" : "outline"
                        }
                        aria-pressed={field.state.value === choice}
                        onClick={() => {
                          field.handleChange(choice);
                          setSaved(false);
                          setError("");
                        }}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              )}
            </form.Field>
            <form.Field name="comment">
              {(field) => (
                <label>
                  What worked or should change? (optional)
                  <textarea
                    rows={3}
                    maxLength={4096}
                    disabled={pending}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setSaved(false);
                    }}
                  />
                </label>
              )}
            </form.Field>
            {error && (
              <p role="alert" className="negative">
                {error}
              </p>
            )}
            {saved && <p role="status">Your review is saved.</p>}
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving review…" : "Save review"}
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
