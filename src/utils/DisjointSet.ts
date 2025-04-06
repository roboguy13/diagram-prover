// TODO: Test
export class DisjointSet<A> {
  private parent: Map<A, A>;
  private rank: Map<A, number>;

  constructor(elements: A[]) {
    this.parent = new Map<A, A>();
    this.rank = new Map<A, number>();

    for (const element of elements) {
      this.parent.set(element, element);
      this.rank.set(element, 0);
    }
  }

  find(element: A): A {
    if (this.parent.get(element) !== element) {
      this.parent.set(element, this.find(this.parent.get(element)!));
    }
    return this.parent.get(element)!;
  }

  union(element1: A, element2: A): void {
    const root1 = this.find(element1);
    const root2 = this.find(element2);

    if (this.rank.get(root1)! < this.rank.get(root2)!) {
      this.parent.set(root1, root2);
    } else if (this.rank.get(root1)! > this.rank.get(root2)!) {
      this.parent.set(root2, root1);
    } else {
      this.parent.set(root2, root1);
      this.rank.set(root1, this.rank.get(root1)! + 1);
    }
  }
}
