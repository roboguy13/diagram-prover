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

export type NodeId = { type: 'NodeId'; id: string }

export type Type = Term

export type Context = Array<Type> //Map<VarId, Type>

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
export let exampleTerm: Term = {
  type: 'Pi',
  paramName: 'x',
  paramTy: { type: 'UnitTy' },
  body: {
    type: 'Lam',
    paramName: 'y',
    paramTy: { type: 'UnitTy' },
    body: {
      type: 'App',
      func: { type: 'Var', name: { type: 'VarId', ix: 0 } },
      arg: { type: 'Var', name: { type: 'VarId', ix: 1 } },
    }
  }
}
