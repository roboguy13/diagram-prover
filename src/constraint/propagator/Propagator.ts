// Propagator network
// See "The Art of the Propagator" by Alexey Radul and Gerald Jay Sussman (https://dspace.mit.edu/handle/1721.1/44215)

import { Semigroup } from 'fp-ts/Semigroup'
import { PartialSemigroup } from './PartialSemigroup'
import { isEqual } from 'lodash'

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

export class Cell<A> {
  private content: Content<A>
  private subscribers: Array<(content: Content<A>) => void> = []
  private pSemigroup: PartialSemigroup<A>

  constructor(pSemigroup: PartialSemigroup<A>, content: Content<A> = { kind: 'Unknown' }) {
    this.pSemigroup = pSemigroup
    this.content = content
  }

  watch(subscriber: (content: Content<A>) => void) {
    subscriber(this.content)
    this.subscribers.push(subscriber)
  }

  read(): Content<A> {
    return this.content
  }

  write(content: Content<A>) {
    const previousContent = this.content
    this.content = semigroupContent<A>(this.pSemigroup).concat(this.content, content)

    switch (this.content.kind) {
      case 'Inconsistent':
        throw new Error('Inconsistent content: ' + JSON.stringify(previousContent) + ' and ' + JSON.stringify(content))
        break
      case 'Known':
        if (previousContent.kind === 'Known') {
          if (!isEqual(previousContent.value, this.content.value)) {
            console.log('Content changed: ' + JSON.stringify(previousContent.value) + ' to ' + JSON.stringify(this.content.value))
            this.subscribers.forEach(subscriber => subscriber(content))
          }
        }
    }
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

export function equalPropagator<A>(input1: Cell<A>, input2: Cell<A>, output: Cell<boolean>): void {
  binaryPropagator(input1, input2, output, (a, b) => isEqual(a, b))
  binaryPropagator(input2, input1, output, (b, a) => isEqual(a, b)) // Ensure symmetry
}
