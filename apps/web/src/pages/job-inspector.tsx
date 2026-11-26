import { Button } from "../components/ui/button";
import { StructuredEditor } from "./structured-editor";
import { useState } from "react";
import type { BuilderEdit } from "./builder-form";
const fields = [
  { key: "name", example: '"Build"' },
  { key: "runs-on", example: '["self-hosted","linux"]' },
  { key: "strategy", example: '{"matrix":{"node":[20,22]},"fail-fast":false}' },
  { key: "permissions", example: '{"contents":"read"}' },
  {
    key: "concurrency",
    example: '{"group":"build","cancel-in-progress":true}',
  },
  { key: "outputs", example: '{"result":"${{ steps.build.outputs.result }}"}' },
  { key: "if", example: '"success()"' },
  { key: "timeout-minutes", example: "30" },
  { key: "env", example: '{"CI":"true"}' },
  { key: "uses", example: '"owner/repo/.github/workflows/build.yml@main"' },
  { key: "with", example: '{"environment":"production"}' },
  { key: "secrets", example: '"inherit"' },
];
export function JobInspector({
  body,
  disabled,
  onEdit,
}: {
  body: string;
  disabled: boolean;
  onEdit: (edit: BuilderEdit) => void;
}) {
  const [job, setJob] = useState(""),
    [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  let jobs: { id: string; uses?: string }[] = [];
  try {
    const parsed = JSON.parse(body);
    jobs = parsed.details ?? parsed.jobs ?? [];
  } catch {}
  const current = jobs.find((j) => j.id === job) ?? jobs[0];
  return (
    <details>
      <summary>Job Inspector</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!current) return;
          try {
            const jobFields = Object.fromEntries(
              Object.entries(values).filter(([, v]) => v.trim()),
            );
            for (const raw of Object.values(jobFields)) JSON.parse(raw);
            if (!Object.keys(jobFields).length)
              throw Error("Choose at least one field");
            setError("");
            onEdit({ kind: "configure-job", job: current.id, jobFields });
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <fieldset disabled={disabled || !current}>
          <label>
            Job
            <select
              value={current?.id ?? ""}
              onChange={(e) => {
                setJob(e.target.value);
                setValues({});
                setError("");
              }}
            >
              {jobs.map((j) => (
                <option key={j.id}>{j.id}</option>
              ))}
            </select>
          </label>
          <p>
            Enter JSON values for fields to change. Leave other fields empty.
          </p>
          {fields
            .filter((f) =>
              current?.uses
                ? ![
                    "runs-on",
                    "strategy",
                    "outputs",
                    "timeout-minutes",
                    "env",
                  ].includes(f.key)
                : !["uses", "with", "secrets"].includes(f.key),
            )
            .map((f) => (
              <label key={f.key}>
                {f.key}
                <StructuredEditor
                  disabled={disabled || !current}
                  placeholder={f.example}
                  value={values[f.key] ?? ""}
                  onChange={(value) =>
                    setValues((v) => ({ ...v, [f.key]: value }))
                  }
                />
              </label>
            ))}
          <Button type="submit">Review job patch</Button>
          {error && <p role="alert">{error}</p>}
        </fieldset>
      </form>
    </details>
  );
}
