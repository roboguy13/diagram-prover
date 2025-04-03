// Propagator network
// See "The Art of the Propagator" by Alexey Radul and Gerald Jay Sussman (https://dspace.mit.edu/handle/1721.1/44215)

import { Semigroup } from 'fp-ts/Semigroup'
import { PartialSemigroup } from './PartialSemigroup'
import { isEqual } from 'lodash'
import { DesktopIcon } from '@radix-ui/react-icons'

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

declare const cellRefBrand: unique symbol

export type CellRef = number & { readonly [cellRefBrand]: unique symbol }

export type PropagatorDescription = { description: string, inputs: CellRef[], outputs: CellRef[] }

export type Conflict<A> =
  { cell: CellRef
  , oldContent: Content<A>
  , newContent: Content<A>
  , propagator1: PropagatorDescription
  , propagator2: PropagatorDescription
  , allWrites: [PropagatorDescription, Content<A>][]
  }

export type ConflictHandler<A> =
  (net: PropagatorNetwork<A>) => (conflict: Conflict<A>) => void

export class PropagatorNetwork<A> {
  private _cells: Cell<A>[] = []
  private _pSemigroup: PartialSemigroup<A>
  private _propagatorConnections: Array<PropagatorDescription> = []
  private _conflict: Conflict<A> | null = null
  private _conflictHandlers: ConflictHandler<A>[] = []
  private _isInconsistent = false
  private _conflictHandlersEnabled: boolean = true

  private _aPrinter: (a: A) => string

  private _debugCells: [string, CellRef][] = []

  constructor(aPrinter: (a: A) => string, pSemigroup: PartialSemigroup<A>, conflictHandlers: ConflictHandler<A>[]) {
    this._aPrinter = aPrinter

    conflictHandlers.push(net => conflict => {
      this._isInconsistent = true
    })

    this._pSemigroup = pSemigroup
    this._conflictHandlers = conflictHandlers
  }

  public get aPrinter(): (a: A) => string {
    return this._aPrinter
  }

  public disableConflictHandlers() {
    this._conflictHandlersEnabled = false
  }

  public enableConflictHandlers() {
    this._conflictHandlersEnabled = true
  }

  public get conflictHandlersEnabled(): boolean {
    return this._conflictHandlersEnabled
  }

  public get conflictHandlers(): ConflictHandler<A>[] {
    return this._conflictHandlers
  }

  public get propagatorConnections(): Array<PropagatorDescription> {
    return this._propagatorConnections
  }

  public get conflict(): Conflict<A> | null {
    return this._conflict
  }

  public get isInconsistent(): boolean {
    return this._isInconsistent
  }

  public getCellRefs(): CellRef[] {
    return this._cells.map((_, i) => i as CellRef)
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

  addDebugCell(context: string, cellRef: CellRef) {
    this._debugCells.push([context, cellRef])
  }

  printDebugCells(aPrinter: (a: A) => string) {
    if (this._debugCells.length === 0) {
      return
    }

    console.log('Debug cells:')
    this._debugCells.forEach(pair => {
      let [context, cellRef] = pair
      console.log(`${context}:`, this._cells[cellRef]!.description, printContent(aPrinter)(this._cells[cellRef]!.read()))
    }
    )
  }

  addKnownTransitionDebugCell(cellRef: CellRef) {
    this._cells[cellRef]!.signalKnownTransition = true
  }

  cells(): CellRef[] {
    return this._cells.map((_, i) => i as CellRef)
  }

  newCell(description: string, content: Content<A>): CellRef {
    let cellRef = this._cells.length as CellRef
    this._cells.push(new Cell(this, this._pSemigroup, cellRef, description, this._conflictHandlers.map(f => f(this)), content))
    return cellRef
  }

  watchCell(cellRef: CellRef, subscriber: (content: Content<A>) => void) {
    this._cells[cellRef]!.watch(subscriber)
  }

  readCell(cellRef: CellRef): Content<A> {
    return this._cells[cellRef]!.read()
  }

  writeCell(writer: PropagatorDescription, cellRef: CellRef, content: Content<A>) {
    return this._cells[cellRef]!.write(writer, content)
  }

  updateCell(writer: PropagatorDescription, cellRef: CellRef, f: (content: Content<A>) => Content<A>) {
    return this._cells[cellRef]!.update(writer, f)
  }

  updateCellKnown(writer: PropagatorDescription, cellRef: CellRef, f: (value: A) => A) {
    return this._cells[cellRef]!.updateKnown(writer, f)
  }

  readKnownOrError(cellRef: CellRef, errMsg: string): A {
    return this._cells[cellRef]!.readKnownOrError(errMsg)
  }

  cellDescription(cellRef: CellRef): string {
    return this._cells[cellRef]!.description
  }

  private addPropagatorConnection =
    DEBUG_PROPAGATOR_NETWORK
        ?
      (description: string, inputs: CellRef[], outputs: CellRef[]) => {
        this._propagatorConnections.push({ description, inputs, outputs })
      }
        :
      (_description: string, _input: CellRef[], _output: CellRef[]) => { }

  unaryPropagator(writer: string, opName: string, input: CellRef, output: CellRef, f: (a: A) => A) {
    let inputCell = this._cells[input]!
    let outputCell = this._cells[output]!

    let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input], outputs: [output] }

    this.addPropagatorConnection(`${opName}(${writer}, ${inputCell.description}, ${outputCell.description})`, [input], [output])

    inputCell.watch(content => {
      outputCell.write(propagatorDescription, mapContent(f)(content))
    })
  }

  binaryPropagator(writer: string, opName: string, input1: CellRef, input2: CellRef, output: CellRef, f: (a: A, b: A) => A) {
    let input1Cell = this._cells[input1]!
    let input2Cell = this._cells[input2]!
    let outputCell = this._cells[output]!

    let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input1, input2], outputs: [output] }

    this.addPropagatorConnection(`${opName}(${writer}, ${input1Cell.description}, ${input2Cell.description}, ${outputCell.description})`, [input1, input2], [output])

    input1Cell.watch(content1 => {
      let content2 = input2Cell.read()
      outputCell.write(propagatorDescription, map2Content(f)(content1, content2))
    })

    input2Cell.watch(content2 => {
      let content1 = input1Cell.read()
      outputCell.write(propagatorDescription, map2Content(f)(content1, content2))
    })
  }

  unaryPropagatorBind(writer: string, input: CellRef, output: CellRef, f: (a: A) => Content<A>) {
    let inputCell = this._cells[input]!
    let outputCell = this._cells[output]!

    let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input], outputs: [output] }

    this.addPropagatorConnection(`unaryPropagatorBind(${writer}, ${inputCell.description}, ${outputCell.description})`, [input], [output])

    inputCell.watch(content => {
      outputCell.write(propagatorDescription, bindContent(f)(content))
    })
  }

  binaryPropagatorBind(writer: string, input1: CellRef, input2: CellRef, output: CellRef, f: (a: A, b: A) => Content<A>) {
    let input1Cell = this._cells[input1]!
    let input2Cell = this._cells[input2]!
    let outputCell = this._cells[output]!

    let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input1, input2], outputs: [output] }

    this.addPropagatorConnection(`binaryPropagatorBind(${writer}, ${input1Cell.description}, ${input2Cell.description}, ${outputCell.description})`, [input1, input2], [output])

    input1Cell.watch(content1 => {
      let content2 = input2Cell.read()
      outputCell.write(propagatorDescription, bindContent2(f)(content1, content2))
    })

    input2Cell.watch(content2 => {
      let content1 = input1Cell.read()
      outputCell.write(propagatorDescription, bindContent2(f)(content1, content2))
    })
  }

  naryPropagator(writer: string, inputs: CellRef[], output: CellRef, f: (as: A[]) => A) {
    let inputCells = inputs.map(input => this._cells[input]!)
    let outputCell = this._cells[output]!

    let propagatorDescription: PropagatorDescription = { description: writer, inputs, outputs: [output] }

    this.addPropagatorConnection(`naryPropagator(${writer}, ${inputCells.map(cell => cell.description).join(', ')}, ${outputCell.description})`, inputs, [output])

    inputCells.forEach((inputCell, i) => {
      inputCell.watch(content => {
        let contentsBeforeIx = inputCells.slice(0, i).map(inputCell => inputCell.read())
        let contentsAfterIx = inputCells.slice(i + 1).map(inputCell => inputCell.read())
        let contents = [...contentsBeforeIx, content, ...contentsAfterIx]
        outputCell.write(propagatorDescription, mapContentList(f)(contents))
      })
    })
  }

  foldLeftPropagator(writer: string, opName: string, inputs: CellRef[], output: CellRef, f: (a: CellRef, b: CellRef, result: CellRef) => void): void {
    if (inputs.length === 1) {
      equalPropagator(
        `${writer}-single-input`,
        this._cells[inputs[0]!]!, // input cell
        this._cells[output]!
      )
      return
    }

    if (inputs.length < 2) {
      throw new Error('foldLeftPropagator requires at least two inputs')
    }

    let previousTempCellRef: CellRef = this.newCell(`temp-cell-for-${opName}`, unknown())

    f(inputs[0]!, inputs[1]!, previousTempCellRef)

    for (let i = 2; i < inputs.length - 1; i++) {
      let currentTempCellRef = this.newCell(`temp-cell-for-${opName}-${i}`, unknown())

      f(previousTempCellRef, inputs[i]!, currentTempCellRef)
      previousTempCellRef = currentTempCellRef
    }

    f(previousTempCellRef, inputs[inputs.length - 1]!, output)
  }

  equalPropagator(writer: string, cell1: CellRef, cell2: CellRef): void {
    this.addPropagatorConnection(`equalPropagator(${writer}, ${this._cells[cell1]!.description}, ${this._cells[cell2]!.description})`, [cell1], [cell2])

    this.unaryPropagator(writer, '=', cell1, cell2, a => a)
    this.unaryPropagator(writer, '=', cell2, cell1, a => a)
  }
}

export class InconsistentError<A> extends Error {
  private _conflict: Conflict<A>

  constructor(conflict: Conflict<A>) {
    super(InconsistentError.errorMsgInternal(conflict))
    this._conflict = conflict
  }

  get conflict(): Conflict<A> {
    return this._conflict
  }

  errorMsg(): string {
    return InconsistentError.errorMsgInternal(this._conflict)
  }

  private static errorMsgInternal<A>(conflict: Conflict<A>): string {
    return `Inconsistent content: ${conflict.cell} ${JSON.stringify(conflict.oldContent)} ${JSON.stringify(conflict.newContent)} ${JSON.stringify(conflict.propagator1)} ${JSON.stringify(conflict.propagator2)}`
  }
}

export class ContentIsNotKnownError extends Error {
  constructor(msg: string) {
    super('Content is not known: ' + msg)
  }
}

class Cell<A> {
  private _net: PropagatorNetwork<A>
  private _content: Content<A>
  private _subscribers: Array<(content: Content<A>) => void> = []
  private _pSemigroup: PartialSemigroup<A>
  private readonly _description: string

  private _lastWriter: PropagatorDescription | null = null
  private _allWrites: [PropagatorDescription, Content<A>][] = []
  private _signaledInconsistency = false

  private _signalKnownTransition = false

  private _undoStack: Content<A>[] = []

  private _ref: CellRef

  constructor(net: PropagatorNetwork<A>, pSemigroup: PartialSemigroup<A>, ref: CellRef, description: string, conflictHandlers: ((conflict: Conflict<A>) => void)[], content: Content<A> = { kind: 'Unknown' }) {
    this._net = net
    this._pSemigroup = pSemigroup
    this._content = content
    this._description = description
    this._ref = ref
  }

  get description(): string {
    return this._description
  }

  get ref(): CellRef {
    return this._ref
  }

  set signalKnownTransition(value: boolean) {
    this._signalKnownTransition = value

    if (this._content.kind === 'Known') {
      console.warn(`Known (already) transition: ${this._description} ${this._net.aPrinter(this._content.value)}`)
    }
  }

  checkpoint(): void {
    this._undoStack.push(structuredClone(this._content))
  }

  revert(): void {
    this._content = structuredClone(this._undoStack.pop()!)
  }

  updateSubscribers() {
    this._subscribers.forEach(subscriber => subscriber(this._content))
  }

  watch(subscriber: (content: Content<A>) => void) {
    subscriber(this._content)
    this._subscribers.push(subscriber)
  }

  // This updates without notifying subscribers.
  // This is useful for updating all the cells in a network before notifying subscribers.
  basicUpdate(f: (a: A) => A) {
    this._content = mapContent(f)(this._content)
  }

  read(): Content<A> {
    return this._content
  }

  write(writer: PropagatorDescription, content: Content<A>) {
    let previousContent = this._content
    this._content = semigroupContent<A>(this._pSemigroup).concat(this._content, content)

    switch (this._content.kind) {
        case 'Inconsistent':
          if (this._net.conflictHandlersEnabled && this._net.conflictHandlers.length > 0) {
            if (!this._signaledInconsistency) {
              this._allWrites.pop() // We already keep track of the last writer in propagator1 and oldContent
              this._signaledInconsistency = true
              let err = new InconsistentError({ cell: this._ref, oldContent: previousContent, newContent: content, propagator1: this._lastWriter!, propagator2: writer!, allWrites: this._allWrites })
              console.error(err.errorMsg())
            }
            this._net.conflictHandlers.forEach(handler => handler(this._net)({
              cell: this._ref,
              oldContent: previousContent,
              newContent: content,
              propagator1: this._lastWriter!,
              propagator2: writer!,
              allWrites: this._allWrites
            }))
          } else {
            throw new InconsistentError({ cell: this._ref, oldContent: previousContent, newContent: this._content, propagator1: this._lastWriter!, propagator2: writer!, allWrites: this._allWrites })
          }
          break
          // throw new InconsistentError(JSON.stringify(previousContent), JSON.stringify(content))
        case 'Known':
          if (previousContent.kind === 'Known') {
            if (!isEqual(previousContent.value, this._content.value)) {
              if (DEBUG_PROPAGATOR_NETWORK) {
                this._allWrites.push([writer, this._content])
              }
              this._subscribers.forEach(subscriber => subscriber(content))
            }
          } else {
            if (DEBUG_PROPAGATOR_NETWORK) {
                this._allWrites.push([writer, this._content]);
            }
            this._subscribers.forEach(subscriber => subscriber(content));
            if (this._signalKnownTransition) {
              console.warn(`Known transition: ${this._description} ${this._net.aPrinter(this._content.value)}`)
            }
          }
          break
      }

    this._lastWriter = writer
  }

  update(writer: PropagatorDescription, f: (content: Content<A>) => Content<A>) {
    this.write(writer, f(this._content))
  }

  updateKnown(writer: PropagatorDescription, f: (value: A) => A) {
    this.update(writer, content => mapContent(f)(content))
  }

  writeKnown(writer: PropagatorDescription, value: A) {
    this.write(writer, known(value))
  }

  writeUnknown(writer: PropagatorDescription) {
    this.write(writer, unknown())
  }

  writeInconsistent(writer: PropagatorDescription) {
    this.write(writer, inconsistent())
  }

  readKnownOrError(errMsg: string): A {
    let content = this.read()
    if (content.kind === 'Known') {
      return content.value
    } else {
      throw new ContentIsNotKnownError(errMsg)
    }
  }
}

export function unaryPropagator<A, B>(writer: string, input: Cell<A>, output: Cell<B>, f: (a: A) => B) {
  let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input.ref], outputs: [output.ref] }

  input.watch(content => {
    output.write(propagatorDescription, mapContent(f)(content))
  })
}

export function binaryPropagator<A, B, C>(writer: string, input1: Cell<A>, input2: Cell<B>, output: Cell<C>, f: (a: A, b: B) => C) {
  let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input1.ref, input2.ref], outputs: [output.ref] }

  input1.watch(content1 => {
    let content2 = input2.read()
    output.write(propagatorDescription, map2Content(f)(content1, content2))
  })

  input2.watch(content2 => {
    let content1 = input1.read()
    output.write(propagatorDescription, map2Content(f)(content1, content2))
  })
}

export function unaryPropagatorBind<A, B>(writer: string, input: Cell<A>, output: Cell<B>, f: (a: A) => Content<B>) {
  let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input.ref], outputs: [output.ref] }

  input.watch(content => {
    output.write(propagatorDescription, bindContent(f)(content))
  })
}

export function binaryPropagatorBind<A, B, C>(writer: string, input1: Cell<A>, input2: Cell<B>, output: Cell<C>, f: (a: A, b: B) => Content<C>) {
  let propagatorDescription: PropagatorDescription = { description: writer, inputs: [input1.ref, input2.ref], outputs: [output.ref] }

  input1.watch(content1 => {
    let content2 = input2.read()
    output.write(propagatorDescription, bindContent2(f)(content1, content2))
  })

  input2.watch(content2 => {
    let content1 = input1.read()
    output.write(propagatorDescription, bindContent2(f)(content1, content2))
  })
}

export function naryPropagator<A, B>(writer: string, inputs: Cell<A>[], output: Cell<B>, f: (as: A[]) => B) {
  let propagatorDescription: PropagatorDescription = { description: writer, inputs: inputs.map(input => input.ref), outputs: [output.ref] }

  inputs.forEach((input, i) => {
    input.watch(content => {
      let contentsBeforeIx = inputs.slice(0, i).map(input => input.read())
      let contentsAfterIx = inputs.slice(i + 1).map(input => input.read())
      let contents = [...contentsBeforeIx, content, ...contentsAfterIx]
      output.write(propagatorDescription, mapContentList(f)(contents))
    })
  })
}

export function equalPropagator<A>(writer: string, cell1: Cell<A>, cell2: Cell<A>): void {
  unaryPropagator(writer, cell1, cell2, a => a)
  unaryPropagator(writer, cell2, cell1, a => a)
}

export function printContent<A>(aPrinter: (a: A) => string) { return (content: Content<A>): string => {
    switch (content.kind) {
      case 'Known': return aPrinter(content.value)
      case 'Unknown': return 'Unknown'
      case 'Inconsistent': return 'Inconsistent'
    }
  }
}

