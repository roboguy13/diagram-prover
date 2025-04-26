export type TermId = string

// TODO: Is there a way to remove this duplication?
export type TermKind = 'Var' | 'UnitTy' | 'Empty' | 'Type' | 'unit' | 'Pi' | 'Lam' | 'App' | 'Ann'

export type VarTerm =
  | {
    type: 'Var';
    kind: 'BoundVar';
    index: number;
    // name?: string; // TODO: Add this later for better pretty printing?
    id?: TermId;
  }
  | {
    type: 'Var';
    kind: 'FreeVar';
    name: string;
    id?: TermId;
  }


export type UnitTyTerm = { type: 'UnitTy'; id?: TermId }
export type EmptyTerm = { type: 'Empty'; id?: TermId }
export type TypeTerm = { type: 'Type'; universe: number; id?: TermId }
export type UnitTerm = { type: 'unit'; id?: TermId }
export type PiTerm = { type: 'Pi'; paramTy: Type; body: Term; id?: TermId }
export type LamTerm = { type: 'Lam'; paramTy: Type; body: Term; id?: TermId }
export type AppTerm = { type: 'App'; func: Term; arg: Term; id?: TermId }
export type AnnTerm = { type: 'Ann'; term: Term; ty: Type; id?: TermId }

// TODO: Add sigma types, identity types and Prop
export type Term =
  | VarTerm

  | UnitTyTerm
  | EmptyTerm
  | TypeTerm

  | UnitTerm
  | PiTerm
  | LamTerm
  | AppTerm
  | AnnTerm

export function collectLams(t: Term): { paramCount: number; body: Term } {
  if (t.type === 'Lam') {
    let { paramCount, body } = collectLams(t.body);
    return { paramCount: paramCount + 1, body };
  } else {
    return { paramCount: 0, body: t };
  }
}

export function boundVarTerm(index: number, id?: TermId): Term {
  return { type: 'Var', kind: 'BoundVar', index, ...(id !== undefined ? { id } : {}) }
}

export function freeVarTerm(name: string, id?: TermId): Term {
  return { type: 'Var', kind: 'FreeVar', name, ...(id !== undefined ? { id } : {}) }
}

export function unitTyTerm(id?: TermId): Term {
  return { type: 'UnitTy', ...(id !== undefined ? { id } : {}) }
}

export function emptyTerm(id?: TermId): Term {
  return { type: 'Empty', ...(id !== undefined ? { id } : {}) }
}

export function typeTerm(universe: number=0, id?: TermId): Term {
  return { type: 'Type', universe: universe, ...(id !== undefined ? { id } : {}) }
}

export function unitTerm(id?: TermId): Term {
  return { type: 'unit', ...(id !== undefined ? { id } : {}) }
}

export function piTerm(paramTy: Type, body: Term, id?: TermId): Term {
  return { type: 'Pi',
           paramTy,
           body,
           ...(id !== undefined ? { id } : {}) }
}

export function lamTerm(paramTy: Type, body: Term, id?: TermId): Term {
  return { type: 'Lam', paramTy, body, ...(id !== undefined ? { id } : {}) }
}

export function appTerm(func: Term, arg: Term, id?: TermId): Term {
  return { type: 'App', func, arg, ...(id !== undefined ? { id } : {}) }
}

export function annTerm(term: Term, ty: Type, id?: TermId): Term {
  return { type: 'Ann', term, ty, ...(id !== undefined ? { id } : {}) }
}

export type NodeId = { type: 'NodeId'; id: string }

export type Type = Term

export type Context = Array<Type> //Map<VarId, Type>

let nextTermId = 0;

export function annotateTermWithIds(t: Term): Term {
  switch (t.type) {
    case 'Var':
      return { ...t, id: 'term-' + nextTermId++ };
    case 'UnitTy':
      return { ...t, id: 'term-' + nextTermId++ };
    case 'Empty':
      return { ...t, id: 'term-' + nextTermId++ };
    case 'Type':
      return { ...t, id: 'term-' + nextTermId++ };
    case 'unit':
      return { ...t, id: 'term-' + nextTermId++ };
    case 'Pi':
      return { ...t, id: 'term-' + nextTermId++, paramTy: annotateTermWithIds(t.paramTy), body: annotateTermWithIds(t.body) };
    case 'Lam':
      return { ...t, id: 'term-' + nextTermId++, paramTy: annotateTermWithIds(t.paramTy), body: annotateTermWithIds(t.body) };
    case 'App':
      return { ...t, id: 'term-' + nextTermId++, func: annotateTermWithIds(t.func), arg: annotateTermWithIds(t.arg) };
    case 'Ann':
      return { ...t, id: 'term-' + nextTermId++, term: annotateTermWithIds(t.term), ty: annotateTermWithIds(t.ty) };
  }
}

// TODO: Do we need an ID here?
export type Sequent = { type: 'Sequent'; context: Context; consequent: Type }

// TODO: Find a better way
export function hasAllIds(t: Term): boolean {
  switch (t.type) {
    case 'Var':
      return t.id !== undefined;
    case 'UnitTy':
      return t.id !== undefined;
    case 'Empty':
      return t.id !== undefined;
    case 'Type':
      return t.id !== undefined;
    case 'unit':
      return t.id !== undefined;
    case 'Pi':
      return t.id !== undefined && hasAllIds(t.paramTy) && hasAllIds(t.body);
    case 'Lam':
      return t.id !== undefined && hasAllIds(t.paramTy) && hasAllIds(t.body);
    case 'App':
      return t.id !== undefined && hasAllIds(t.func) && hasAllIds(t.arg);
    case 'Ann':
      return t.id !== undefined && hasAllIds(t.term) && hasAllIds(t.ty);
  }
}

export class FreshNameGenerator {
  private static _counter = 0;
  public static freshName(): string {
    return `fv-${FreshNameGenerator._counter++}`;
  }
}

// A simple example term
export let idTerm = (ty: Type): Term =>
  lamTerm(ty, boundVarTerm(0));

// export let exampleTerm: Term = lamTerm(unitTyTerm(), appTerm(boundVarTerm(0), boundVarTerm(0)))

let plus: Term =
  lamTerm(
    // m
    unitTyTerm(),
    lamTerm(
      // n
      unitTyTerm(),
      lamTerm(
        // f
        unitTyTerm(),
        lamTerm(
          // x
          unitTyTerm(),
          appTerm(
            appTerm(
              boundVarTerm(3),
              boundVarTerm(1))
            ,
            appTerm(
              appTerm(
                boundVarTerm(2),
                boundVarTerm(1)),
              boundVarTerm(0))
          )
        )
      )
    )
  );

let zero =
  lamTerm(
    unitTyTerm(),
    lamTerm(
      unitTyTerm(),
      lamTerm(
        unitTyTerm(),
        boundVarTerm(0)
      )
    )
  );

let succ =
  lamTerm(
    unitTyTerm(),
    lamTerm(
      unitTyTerm(),
      lamTerm(
        unitTyTerm(),
        appTerm(
          boundVarTerm(1),
          appTerm(
            appTerm(
              boundVarTerm(2),
              boundVarTerm(1)
            ),
            boundVarTerm(0)
          )
        )
      )
    )
  );

let one = appTerm(succ, zero);
let two = appTerm(succ, one);
let three = appTerm(succ, two);

export let exampleTerm: Term = //idTerm(unitTyTerm());
  plus

  // appTerm(
  //   lamTerm(piTerm(unitTyTerm(), unitTyTerm()),
  //     lamTerm(unitTyTerm(),
  //       appTerm(
  //         boundVarTerm(1),
  //         boundVarTerm(0)
  //       )
  //     )
  //   ),
  //   idTerm(unitTyTerm())
  // );

  // lamTerm(
  //   unitTyTerm(),
  //   appTerm(
  //     boundVarTerm(0),
  //     boundVarTerm(0)
  //   )
  // );