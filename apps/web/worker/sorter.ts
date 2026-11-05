// The sort's Durable Object (m1kuorg/basics#60): one per shelf, named by
// the shelf's id, so each shelf sorts one upload at a time while shelves
// sort side by side. It keeps nothing of its own but its alarm: the
// uploads' status and progress stay in D1 (server/sort.ts). Each alarm
// sorts one batch, and sets the next while any upload of the shelf is
// still to sort. A stored alarm carries on after a restart or a deploy,
// and one cut off mid-batch runs again. A deleted shelf or account leaves
// nothing to sort, so its alarms stop.

import { DurableObject } from "cloudflare:workers";
import type { Env, ShelfSort } from "../server/config";
import { sortNextBatch } from "../server/sort";
import type { Db } from "../server/store/db";

export class Sorter extends DurableObject<Env> implements ShelfSort {
  /**
   * Sets the alarm for now, always: it starts the sort, and while a batch
   * is under way it runs again once that batch is done, since only one
   * alarm runs at a time.
   */
  async start(): Promise<void> {
    if (this.env.SORTER_FAULT === "start") throw new Error("The check's fault: the sort doesn't start.");
    await this.ctx.storage.setAlarm(Date.now());
  }

  /**
   * One batch of the shelf's sort; a failure is recorded on its upload
   * rather than thrown. Nothing escapes it, not even a database failure
   * that keeps the failure from being recorded: that's logged nowhere,
   * since an error may hold anything, and the runtime doesn't retry it.
   * The upload stays waiting or sorting until the shelf's sort is started
   * again, by the cron (server/sort.ts's resumeStalledSorts) if nothing
   * else.
   */
  override async alarm(): Promise<void> {
    const shelfId = this.ctx.id.name;
    const env = this.env.SORTER_FAULT === "database" ? { ...this.env, DB: outOfReach() } : this.env;
    try {
      if (shelfId && (await sortNextBatch(env, shelfId))) await this.ctx.storage.setAlarm(Date.now());
    } catch {
      // Left as it stands, for the cron.
    }
  }
}

/** A database whose every query fails, as one out of reach would: the check's "database" fault. */
function outOfReach(): Db {
  const fail = () => {
    throw new Error("D1_ERROR: the check's fault: the database is out of reach.");
  };
  return { prepare: fail, batch: fail, exec: fail } as unknown as Db;
}
