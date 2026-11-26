import Dexie, { type Table } from "dexie";
export type Draft = { id: string; filename: string; source: string; original: string; updatedAt: number; open: boolean };
class StudioDB extends Dexie {
  drafts!: Table<Draft, string>;
  constructor() { super("orb-workflow-studio"); this.version(1).stores({ drafts: "id,updatedAt,open" }); }
}
export const studioDB = new StudioDB();
