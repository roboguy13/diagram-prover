import { ThickArrowRightIcon } from "@radix-ui/react-icons";
import { produce, immerable } from "immer";

export class ChangeTracker<A, B> {
  // Invariant:
  //   Unless our last call to changers has given back nothing,
  //     changes.length > currentChangeIx + 1

  [immerable] = true;

  private changes: A[];
  private currentChangeIx: number;
  private history: B[];
  private changer: ((x: B) => [A, B] | null);

  constructor(item: B, changer: ((x: B) => [A, B] | null)) {
    let [change, nextItem] = changer(item)!;

    this.changes = [change];
    this.currentChangeIx = 0;
    this.history = [item, nextItem];

    this.changer = changer
  }

  public historyLength(): number {
    return this.history.length;
  }

  public setCurrentChangeIx(ix: number): ChangeTracker<A, B> {
    return produce(this, (draft: ChangeTracker<A, B>) => {
      this.currentChangeIx = ix;
    });
  }

  public getCurrent(): B {
    return this.history[this.currentChangeIx]!;
  }

  public getChangeAfterPresent(): [ChangeTracker<A, B>, [A, B] | null] {
    if (this.currentChangeIx < this.changes.length) {
      return [this, [this.changes[this.currentChangeIx]!, this.history[this.currentChangeIx]!]];
    } else {
      let result = this.changer(this.history[this.currentChangeIx-1]!);

      if (result) {
        let [newChange, newItem] = result;

        let newChangeTracker = produce(this, (draft: ChangeTracker<A, B>) => {
          draft.changes.push(newChange);
          draft.history.push(newItem);
        });

        return [newChangeTracker, [newChange, newItem]];
      }

      return [this, null];
    }
  }

  public rollbackChange(): ChangeTracker<A, B> {
    let ix = this.currentChangeIx - 1;

    return produce(this, (draft: ChangeTracker<A, B>) => {
      draft.currentChangeIx = ix >= 0 ? ix : 0;
    });
  }

  public advanceChange(): ChangeTracker<A, B> {
    let [newChangeTracker, next] = this.getChangeAfterPresent();

    if (next) {
      return produce(newChangeTracker, (draft: ChangeTracker<A, B>) => {
        draft.currentChangeIx += 1
      });
    }

    return newChangeTracker
  }
}
