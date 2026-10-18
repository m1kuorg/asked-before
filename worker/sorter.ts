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

export class Sorter extends DurableObject<Env> implements ShelfSort {
  /**
   * Sets the alarm for now, always: it starts the sort, and while a batch
   * is under way it runs again once that batch is done, since only one
   * alarm runs at a time.
   */
  async start(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now());
  }

  /** One batch of the shelf's sort; a failure is recorded on its upload rather than thrown. */
  override async alarm(): Promise<void> {
    const shelfId = this.ctx.id.name;
    if (shelfId && (await sortNextBatch(this.env, shelfId))) await this.ctx.storage.setAlarm(Date.now());
  }
}
