export type VarId = { type: 'VarId'; ix: number; name?: string } 

export type TermId = string

// TODO: Add sigma types, identity types and Prop
export type Term =
  | { type: 'Var'; name: VarId; id?: TermId }

  | { type: 'UnitTy'; id?: TermId }
  | { type: 'Empty'; id?: TermId }
  | { type: 'Type'; universe: number; id?: TermId }

  | { type: 'unit'; id?: TermId}
  | { type: 'Pi'; paramName?: string; paramTy: Type; body: Term; id?: TermId}
  | { type: 'Lam'; paramName?: string //params: Array<{ name: VarId, paramTy: Term }>
                 ; paramTy: Type
                 ; body: Term
                 ; id?: TermId}
  | { type: 'App'; func: Term; arg: Term; id?: TermId}
  | { type: 'Ann'; term: Term; ty: Type; id?: TermId}

export function varTerm(ix: number, name?: string, id?: TermId): Term {
  return { type: 'Var', name: { type: 'VarId', ix: ix, ...(name !== undefined) ? { name } : {} }, ...(id !== undefined ? { id } : {}) }
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

export const piTerm = (paramName?: string) => function (paramTy: Type, body: Term, id?: TermId): Term {
  return { type: 'Pi',
           ...(paramName !== undefined ? { paramName } : {}),
           paramTy,
           body,
           ...(id !== undefined ? { id } : {}) }
}

export function lamTerm(paramName: string, paramTy: Type, body: Term, id?: TermId): Term {
  return { type: 'Lam', paramName, paramTy, body, ...(id !== undefined ? { id } : {}) }
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

// A simple example term
export let idTerm = (ty: Type): Term =>
  lamTerm('z', ty, varTerm(0, 'z'));

export let exampleTerm: Term =
  appTerm(
    lamTerm('x', piTerm()(unitTyTerm(), unitTyTerm()),
      lamTerm('y', unitTyTerm(),
        appTerm(
          varTerm(1, 'x'),
          varTerm(0, 'y')
        )
      )
    ),
    idTerm(unitTyTerm())
  );
