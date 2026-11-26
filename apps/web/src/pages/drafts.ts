import Dexie, { type Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
export type Draft = {
  id: string;
  repo: string;
  ref: string;
  path: string;
  yaml: string;
  original: string;
  updatedAt: number;
};
export const documentId = (repo: string, ref: string, path: string) =>
  JSON.stringify([repo, ref, path]);
class DraftDatabase extends Dexie {
  drafts!: Table<Draft, string>;
  constructor() {
    super("orb-workflow-drafts");
    this.version(1).stores({ drafts: "id,repo,updatedAt" });
  }
}
const db = new DraftDatabase();
export function useDrafts(repos: string[]) {
  const [error, setError] = useState("");
  const items = useLiveQuery(
    async () => {
      try {
        return (await db.drafts.where("repo").anyOf(repos).toArray()).sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
      } catch (e) {
        setError(String(e));
        return [];
      }
    },
    [repos.join(",")],
    [],
  );
  return {
    items,
    error,
    get: (id: string) => db.drafts.get(id),
    save: (draft: Draft) => db.drafts.put(draft),
    remove: (id: string) => db.drafts.delete(id),
  };
}
