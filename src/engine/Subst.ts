import { boundVarTerm, freeVarTerm, FreshNameGenerator, Term, VarTerm } from './Term'

type IndexRenaming = (x: number) => number
type Subst = (x: number) => Term

type Renamer = (v: VarTerm) => VarTerm

export function open(term: Term): { newName: string, term: Term } {
  const newName = FreshNameGenerator.freshName()
  const v = freeVarTerm(newName)

  return {
    newName,
    term: subst1(term, v)
  }
}

export function subst1(term: Term, u: Term): Term {
  return subst(function(x: number): Term {
    if (x === 0) {
      return u
    } else {
      return { type: 'Var', kind: 'BoundVar', index: x - 1 }
    }
  }, term)
}

export function subst(sigma: Subst, term: Term): Term {
  switch (term.type) {
    case 'Var':
      if (term.kind === 'FreeVar') {
        return term
      } else {
        return sigma(term.index)
      }
    case 'UnitTy':
      return term
    case 'Empty':
      return term
    case 'Type':
      return term
    case 'unit':
      return term
    case 'Pi':
      return { ...term, paramTy: subst(sigma, term.paramTy), body: subst(exts(sigma), term.body) }
    case 'Lam':
      return { ...term, paramTy: subst(sigma, term.paramTy), body: subst(exts(sigma), term.body) }
    case 'App':
      return { ...term, func: subst(sigma, term.func), arg: subst(sigma, term.arg) }
    case 'Ann':
      return { ...term, term: subst(sigma, term.term), ty: subst(sigma, term.ty) }
  }
}

function indexRenamerToRenamer(rho: IndexRenaming): Renamer {
  return (v: VarTerm): VarTerm => {
    switch (v.kind) {
      case 'FreeVar':
        return v
      case 'BoundVar':
        return { ...v, index: rho(v.index) }
    }
  }
}

const ext = (rho: IndexRenaming) => (x: number): number => {
  if (x === 0) {
    return x;
  } else {
    let newId = rho(x - 1);
    return newId + 1
  }
}

function renameIndices<A>(rho: IndexRenaming, term: Term): Term {
  switch (term.type) {
    case 'Var':
      return indexRenamerToRenamer(rho)(term);
      // return { ...term, name: indexRenamerToRenamer(rho)(term.name) }
    case 'UnitTy':
      return term;
    case 'Empty':
      return term;
    case 'Type':
      return term;
    case 'unit':
      return term;
    case 'Pi':
      return { ...term, paramTy: renameIndices(rho, term.paramTy), body: renameIndices(ext(rho), term.body) }
    case 'Lam':
      return { ...term, paramTy: renameIndices(rho, term.paramTy), body: renameIndices(ext(rho), term.body) }
    case 'App':
      return { ...term, func: renameIndices(rho, term.func), arg: renameIndices(rho, term.arg) }
    case 'Ann':
      return { ...term, term: renameIndices(rho, term.term), ty: renameIndices(rho, term.ty) }
  }
}

const exts = function(sigma: Subst) {
  return (x: number): Term => {
    if (x === 0) {
      return boundVarTerm(x)
    } else {
      let newX = x - 1
      return renameIndices((function(y: number) { return y + 1 }), sigma(newX));
    }
  }
}