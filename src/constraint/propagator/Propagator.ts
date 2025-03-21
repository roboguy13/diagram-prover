// Propagator network
// See "The Art of the Propagator" by Alexey Radul and Gerald Jay Sussman (https://dspace.mit.edu/handle/1721.1/44215)

import { Semigroup } from 'fp-ts/Semigroup'
import { PartialSemigroup } from './PartialSemigroup'
import { isEqual } from 'lodash'

const DEBUG_PROPAGATOR_NETWORK = true

export type Content<A> =
  | { kind: 'Inconsistent' }
  | { kind: 'Unknown' }
  | { kind: 'Known', value: A }

export function semigroupContent<A>(S: PartialSemigroup<A>): Semigroup<Content<A>> {
  return {
    concat: (x, y) => {
      if (x.kind === 'Inconsistent' || y.kind === 'Inconsistent') {
        return { kind: 'Inconsistent' }
      }
      if (x.kind === 'Unknown') {
        return y
      }
      if (y.kind === 'Unknown') {
        return x
      }
      
      let z = S.combine(x.value, y.value)
      if (z) {
        return { kind: 'Known', value: z }
      } else {
        return { kind: 'Inconsistent' }
      }
    }
  }
}

export function mapContent<A, B>(f: (a: A) => B): (content: Content<A>) => Content<B> {
  return content => {
    switch (content.kind) {
      case 'Inconsistent':
        return { kind: 'Inconsistent' }
      case 'Unknown':
        return { kind: 'Unknown' }
      case 'Known':
        return { kind: 'Known', value: f(content.value) }
    }
  }
}

export function map2Content<A, B, C>(f: (a: A, b: B) => C): (content1: Content<A>, content2: Content<B>) => Content<C> {
  return (content1, content2) => {
    switch (content1.kind) {
      case 'Inconsistent':
        return { kind: 'Inconsistent' }
      case 'Unknown':
        return { kind: 'Unknown' }
      case 'Known':
        switch (content2.kind) {
          case 'Inconsistent':
            return { kind: 'Inconsistent' }
          case 'Unknown':
            return { kind: 'Unknown' }
          case 'Known':
            return { kind: 'Known', value: f(content1.value, content2.value) }
        }
    }
  }
}

export function bindContent<A, B>(f: (a: A) => Content<B>): (content: Content<A>) => Content<B> {
  return content => {
    switch (content.kind) {
      case 'Inconsistent':
        return { kind: 'Inconsistent' }
      case 'Unknown':
        return { kind: 'Unknown' }
      case 'Known':
        return f(content.value)
    }
  }
}

export function bindContent2<A, B, C>(f: (a: A, b: B) => Content<C>): (content1: Content<A>, content2: Content<B>) => Content<C> {
  return (content1, content2) => {
    return bindContent<A, C>(val1 => bindContent<B, C>(val2 => f(val1, val2))(content2))(content1)
  }
}

export function sequenceContentList<A>(contentList: Content<A>[]): Content<A[]> {
  let knownValues = []

  for (let content of contentList) {
    switch (content.kind) {
      case 'Inconsistent':
        return inconsistent()
      case 'Unknown':
        return unknown()
      case 'Known':
        knownValues.push(content.value)
    }
  }

  return known(knownValues)
}

export function mapContentList<A, B>(f: (as: A[]) => B): (contentList: Content<A>[]) => Content<B> {
  return contentList => mapContent(f)(sequenceContentList(contentList))
}

// TODO:
// export function traverseContentList<A, B>(f: (a: A) => Content<B>): (contentList: Content<A>[]) => Content<B[]> {
//   return contentList => {
//     let mappedContentList = contentList.map(content => {
//       switch (content.kind) {
//         case 'Inconsistent':
//           return inconsistent()
//         case 'Unknown':
//           return unknown()
//         case 'Known':
//           return f(content.value)
//       }
//     })
//     return sequenceContentList(mappedContentList)
//   }
// }

export function known<A>(value: A): Content<A> {
  return { kind: 'Known', value }
}

export function unknown<A>(): Content<A> {
  return { kind: 'Unknown' }
}

export function inconsistent<A>(): Content<A> {
  return { kind: 'Inconsistent' }
}

export function waitForKnown<A>(cell: Cell<A>): Promise<A> {
  return new Promise((resolve, reject) => {
    cell.watch(content => {
      switch (content.kind) {
        case 'Known':
          resolve(content.value)
          break
        case 'Inconsistent':
          reject(new Error('Inconsistent content'))
          break
        // 'Unknown' does nothing
      }
    });
  });
}

export type CellRef = number

export class PropagatorNetwork<A> {
  private _cells: Cell<A>[] = []
  private _pSemigroup: PartialSemigroup<A>

  constructor(pSemigroup: PartialSemigroup<A>) {
    this._pSemigroup = pSemigroup
  }

  checkpoint(): void {
    for (let cell of this._cells) {
      cell.checkpoint()
    }
  }

  revert(): void {
    for (let cell of this._cells) {
      cell.revert()
    }
    if (DEBUG_PROPAGATOR_NETWORK) {
      try {
        for (let cell of this._cells) {
          cell.updateSubscribers()
        }
      } catch (e) {
        if (e instanceof InconsistentError) {
          throw new Error('Inconsistent content after revert')
        }
      }
    }
  }

  updateAllCells(cells: CellRef[], f: (a: A) => A) {
    for (let cellRef of cells) {
      let cell = this._cells[cellRef]!
      cell.basicUpdate(f)
    }
    for (let cellRef of cells) {
      let cell = this._cells[cellRef]!
      cell.updateSubscribers()
    }
  }

  cells(): CellRef[] {
    return this._cells.map((_, i) => i)
  }

  newCell(description: string, content: Content<A>): CellRef {
    this._cells.push(new Cell(this._pSemigroup, description, content))
    return this._cells.length - 1
  }

  watchCell(cellRef: CellRef, subscriber: (content: Content<A>) => void) {
    this._cells[cellRef]!.watch(subscriber)
  }

  readCell(cellRef: CellRef): Content<A> {
    return this._cells[cellRef]!.read()
  }

  writeCell(cellRef: CellRef, content: Content<A>) {
    return this._cells[cellRef]!.write(content)
  }

  updateCell(cellRef: CellRef, f: (content: Content<A>) => Content<A>) {
    return this._cells[cellRef]!.update(f)
  }

  updateCellKnown(cellRef: CellRef, f: (value: A) => A) {
    return this._cells[cellRef]!.updateKnown(f)
  }

  readKnownOrError(cellRef: CellRef, errMsg: string): A {
    return this._cells[cellRef]!.readKnownOrError(errMsg)
  }

  cellDescription(cellRef: CellRef): string {
    return this._cells[cellRef]!.description
  }

  unaryPropagator(input: CellRef, output: CellRef, f: (a: A) => A) {
    let inputCell = this._cells[input]!
    let outputCell = this._cells[output]!

    inputCell.watch(content => {
      outputCell.write(mapContent(f)(content))
    })
  }

  binaryPropagator(input1: CellRef, input2: CellRef, output: CellRef, f: (a: A, b: A) => A) {
    let input1Cell = this._cells[input1]!
    let input2Cell = this._cells[input2]!
    let outputCell = this._cells[output]!

    input1Cell.watch(content1 => {
      let content2 = input2Cell.read()
      outputCell.write(map2Content(f)(content1, content2))
    })

    input2Cell.watch(content2 => {
      let content1 = input1Cell.read()
      outputCell.write(map2Content(f)(content1, content2))
    })
  }

  unaryPropagatorBind(input: CellRef, output: CellRef, f: (a: A) => Content<A>) {
    let inputCell = this._cells[input]!
    let outputCell = this._cells[output]!

    inputCell.watch(content => {
      outputCell.write(bindContent(f)(content))
    })
  }

  binaryPropagatorBind(input1: CellRef, input2: CellRef, output: CellRef, f: (a: A, b: A) => Content<A>) {
    let input1Cell = this._cells[input1]!
    let input2Cell = this._cells[input2]!
    let outputCell = this._cells[output]!

    input1Cell.watch(content1 => {
      let content2 = input2Cell.read()
      outputCell.write(bindContent2(f)(content1, content2))
    })

    input2Cell.watch(content2 => {
      let content1 = input1Cell.read()
      outputCell.write(bindContent2(f)(content1, content2))
    })
  }

  naryPropagator(inputs: CellRef[], output: CellRef, f: (as: A[]) => A) {
    let inputCells = inputs.map(input => this._cells[input]!)
    let outputCell = this._cells[output]!

    inputCells.forEach((inputCell, i) => {
      inputCell.watch(content => {
        let contentsBeforeIx = inputCells.slice(0, i).map(inputCell => inputCell.read())
        let contentsAfterIx = inputCells.slice(i + 1).map(inputCell => inputCell.read())
        let contents = [...contentsBeforeIx, content, ...contentsAfterIx]
        outputCell.write(mapContentList(f)(contents))
      })
    })
  }

  equalPropagator(cell1: CellRef, cell2: CellRef): void {
    this.unaryPropagator(cell1, cell2, a => a)
    this.unaryPropagator(cell2, cell1, a => a)
  }
}

export class InconsistentError extends Error {
  constructor(a: string, b: string) {
    super(`Inconsistent content: ${a} and ${b}`)
  }
}

class Cell<A> {
  private content: Content<A>
  private subscribers: Array<(content: Content<A>) => void> = []
  private pSemigroup: PartialSemigroup<A>
  private readonly _description: string

  private undoStack: Content<A>[] = []

  constructor(pSemigroup: PartialSemigroup<A>, description: string, content: Content<A> = { kind: 'Unknown' }) {
    this.pSemigroup = pSemigroup
    this.content = content
    this._description = description
  }

  get description(): string {
    return this._description
  }

  checkpoint(): void {
    this.undoStack.push(structuredClone(this.content))
  }

  revert(): void {
    this.content = structuredClone(this.undoStack.pop()!)
  }

  updateSubscribers() {
    this.subscribers.forEach(subscriber => subscriber(this.content))
  }

  watch(subscriber: (content: Content<A>) => void) {
    subscriber(this.content)
    this.subscribers.push(subscriber)
  }

  // This updates without notifying subscribers.
  // This is useful for updating all the cells in a network before notifying subscribers.
  basicUpdate(f: (a: A) => A) {
    this.content = mapContent(f)(this.content)
  }

  read(): Content<A> {
    return this.content
  }

  write(content: Content<A>) {
    let previousContent = this.content
    this.content = semigroupContent<A>(this.pSemigroup).concat(this.content, content)

    switch (this.content.kind) {
      case 'Inconsistent':
        throw new InconsistentError(JSON.stringify(previousContent), JSON.stringify(content))
      case 'Known':
        if (previousContent.kind === 'Known') {
          if (!isEqual(previousContent.value, this.content.value)) {
            this.subscribers.forEach(subscriber => subscriber(content))
          }
        }
    }
  }

  update(f: (content: Content<A>) => Content<A>) {
    this.write(f(this.content))
  }

  updateKnown(f: (value: A) => A) {
    this.update(content => mapContent(f)(content))
  }

  writeKnown(value: A) {
    this.write(known(value))
  }

  writeUnknown() {
    this.write(unknown())
  }

  writeInconsistent() {
    this.write(inconsistent())
  }

  readKnownOrError(errMsg: string): A {
    let content = this.read()
    if (content.kind === 'Known') {
      return content.value
    } else {
      throw new Error('Content is not known: ' + errMsg)
    }
  }
}

export function unaryPropagator<A, B>(input: Cell<A>, output: Cell<B>, f: (a: A) => B) {
  input.watch(content => {
    output.write(mapContent(f)(content))
  })
}

export function binaryPropagator<A, B, C>(input1: Cell<A>, input2: Cell<B>, output: Cell<C>, f: (a: A, b: B) => C) {
  input1.watch(content1 => {
    let content2 = input2.read()
    output.write(map2Content(f)(content1, content2))
  })

  input2.watch(content2 => {
    let content1 = input1.read()
    output.write(map2Content(f)(content1, content2))
  })
}

export function unaryPropagatorBind<A, B>(input: Cell<A>, output: Cell<B>, f: (a: A) => Content<B>) {
  input.watch(content => {
    output.write(bindContent(f)(content))
  })
}

export function binaryPropagatorBind<A, B, C>(input1: Cell<A>, input2: Cell<B>, output: Cell<C>, f: (a: A, b: B) => Content<C>) {
  input1.watch(content1 => {
    let content2 = input2.read()
    output.write(bindContent2(f)(content1, content2))
  })

  input2.watch(content2 => {
    let content1 = input1.read()
    output.write(bindContent2(f)(content1, content2))
  })
}

export function naryPropagator<A, B>(inputs: Cell<A>[], output: Cell<B>, f: (as: A[]) => B) {
  inputs.forEach((input, i) => {
    input.watch(content => {
      let contentsBeforeIx = inputs.slice(0, i).map(input => input.read())
      let contentsAfterIx = inputs.slice(i + 1).map(input => input.read())
      let contents = [...contentsBeforeIx, content, ...contentsAfterIx]
      output.write(mapContentList(f)(contents))
    })
  })
}

export function equalPropagator<A>(cell1: Cell<A>, cell2: Cell<A>): void {
  unaryPropagator(cell1, cell2, a => a)
  unaryPropagator(cell2, cell1, a => a)
}
