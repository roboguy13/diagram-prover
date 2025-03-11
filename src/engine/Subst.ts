import { VarId, Term } from './Term'

type Renaming = (x: VarId) => VarId
type Subst = (x: VarId) => Term

export function subst1(term: Term, u: Term): Term {
  return subst(function(x: VarId) {
    if (x.ix === 0) {
      return u
    } else {
      return { type: 'Var', name: { ...x, ix: x.ix - 1 } }
    }
  }, term)
}

export function subst(sigma: Subst, term: Term): Term {
  switch (term.type) {
    case 'Var':
      return sigma(term.name)
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

const ext = (rho: Renaming) => (x: VarId): VarId => {
  if (x.ix === 0) {
    return x;
  } else {
    let newId = rho(x);
    return { ...newId, ix: newId.ix + 1 };
  }
}

function rename<A>(rho: Renaming, term: Term): Term {
  switch (term.type) {
    case 'Var':
      return { ...term, name: rho(term.name) }
    case 'UnitTy':
      return term;
    case 'Empty':
      return term;
    case 'Type':
      return term;
    case 'unit':
      return term;
    case 'Pi':
      return { ...term, paramTy: rename(rho, term.paramTy), body: rename(ext(rho), term.body) }
    case 'Lam':
      return { ...term, paramTy: rename(rho, term.paramTy), body: rename(ext(rho), term.body) }
    case 'App':
      return { ...term, func: rename(rho, term.func), arg: rename(rho, term.arg) }
    case 'Ann':
      return { ...term, term: rename(rho, term.term), ty: rename(rho, term.ty) }
  }
}

const exts = function(sigma: Subst) {
  return (x: VarId): Term => {
    if (x.ix === 0) {
      return { type: 'Var', name: x };
    } else {
      let newX = { ...x, ix: x.ix - 1 };
      return rename((function(y: VarId) { return { ... y, ix: y.ix + 1 } }), sigma(newX));
    }
  }
}