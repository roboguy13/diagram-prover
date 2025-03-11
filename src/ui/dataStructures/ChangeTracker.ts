import { ThickArrowRightIcon } from "@radix-ui/react-icons";
import { immerable } from "immer";

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

  public setCurrentChangeIx(ix: number) {
    this.currentChangeIx = ix;
  }

  public getCurrent(): B {
    return this.history[this.currentChangeIx]!;
  }

  public getChangeAfterPresent(): [A, B] | null {
    if (this.currentChangeIx < this.changes.length) {
      return [this.changes[this.currentChangeIx]!, this.history[this.currentChangeIx]!];
    } else {
      let result = this.changer(this.history[this.currentChangeIx]!);

      if (result) {
        let [newChange, newItem] = result;

        this.changes.push(newChange);
        this.history.push(newItem);

        return [newChange, newItem];
      }

      return null;
    }
  }

  public rollbackChange() {
    let ix = this.currentChangeIx - 1;

    console.log('rolling back')

    this.currentChangeIx = ix >= 0 ? ix : 0;
  }

  public advanceChange() {
    let next = this.getChangeAfterPresent();
    console.log('advancing')
    if (next) {
      console.log('advanced')
      this.currentChangeIx += 1;
    }
  }
}
