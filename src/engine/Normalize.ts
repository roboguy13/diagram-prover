import { VarId, Type, Term } from './Term' 
import { subst1 } from './Subst'

// TODO: Also include a function that does one step of normalization, and indicates which term(s) change from the
// input and the output

export type Env = Map<number, Term>

export function equalTerms(term1: Term, term2: Term): boolean {
  return equalTermsHelper(normalize(term1), normalize(term2));
}

function equalTermsHelper(term1: Term, term2: Term): boolean {
  switch (term1.type) {
    case 'Var':
      return term2.type === 'Var' && term1.name.ix === term2.name.ix;
    case 'UnitTy':
      return term2.type === 'UnitTy';
    case 'Empty':
      return term2.type === 'Empty';
    case 'Type':
      return term2.type === 'Type' && term1.universe === term2.universe;
    case 'unit':
      return term2.type === 'unit';
    case 'Pi':
      return term2.type === 'Pi' && equalAbstractions(term1.paramTy, term1.body, term2.paramTy, term2.body);
    case 'Lam':
      return term2.type === 'Lam' && equalAbstractions(term1.paramTy, term1.body, term2.paramTy, term2.body);
    case 'App':
      return term2.type === 'App' && equalTermsHelper(term1.func, term2.func) && equalTermsHelper(term1.arg, term2.arg);
    case 'Ann':
      return term2.type === 'Ann' && equalTermsHelper(term1.term, term2.term) && equalTermsHelper(term1.ty, term2.ty);
  }
}

export function equalAbstractions(ty1: Type, term1: Term, ty2: Type, term2: Term): boolean {
  return equalTermsHelper(ty1, ty2) && equalTermsHelper(term1, term2);
}

export type StepChange =
  | { type: 'no-change' }
  | { type: 'beta'; changedId: string }

export function oneStep(term: Term): [StepChange, Term] {
  switch (term.type) {
    case 'Var':
      return [{ type: 'no-change' }, term];
    case 'UnitTy':
      return [{ type: 'no-change' }, term];
    case 'Empty':
      return [{ type: 'no-change' }, term];
    case 'Type':
      return [{ type: 'no-change' }, term];
    case 'unit':
      return [{ type: 'no-change' }, term];

    case 'Pi': {
      let [paramChange, newParamTy] = oneStep(term.paramTy);

      if (paramChange.type !== 'no-change') {
        return [paramChange, { ...term, paramTy: newParamTy }];
      } else {
        let [bodyChange, newBody] = oneStep(term.body);

        if (bodyChange.type !== 'no-change') {
          return [bodyChange, { ...term, body: newBody }];
        } else {
          return [{ type: 'no-change' }, term];
        }
      }
    }
    case 'Lam': {
      let [paramChange, newParamTy] = oneStep(term.paramTy);

      if (paramChange.type !== 'no-change') {
        return [paramChange, { ...term, paramTy: newParamTy }];
      } else {
        let [bodyChange, newBody] = oneStep(term.body);

        if (bodyChange.type !== 'no-change') {
          return [bodyChange, { ...term, body: newBody }];
        } else {
          return [{ type: 'no-change' }, term];
        }
      }
    }
    case 'App':
      switch (term.func.type) {
        case 'Lam':
          return oneStep(subst1(term.func.body, term.arg));
        case 'Pi':
          return oneStep(subst1(term.func.body, term.arg));
        default:
          return [ { type: 'no-change' }, { ...term, func: term.func, arg: term.arg } ]
      }
    case 'Ann':
      let [termChange, newTerm] = oneStep(term.term);
      if (termChange.type !== 'no-change') {
        return [termChange, { ...term, term: newTerm }];
      }
      let [tyChange, newTy] = oneStep(term.ty);
      return [tyChange, { ...term, ty: newTy }];
  }
}

export function normalize(term: Term): Term {
  switch (term.type) {
    case 'Var':
      return term;
    case 'UnitTy':
      return term;
    case 'Empty':
      return term;
    case 'Type':
      return term;
    case 'unit':
      return term;
    case 'Pi':
      return { ...term, paramTy: normalize(term.paramTy), body: normalizeAbstraction(term.body) }
    case 'Lam':
      return { ...term, body: normalizeAbstraction(term.body) }
    case 'App':
      let newArg = normalize(term.arg);
      let newFunc = normalize(term.func);
      switch (newFunc.type) {
        case 'Lam':
          return normalize(subst1(newFunc.body, newArg));
        case 'Pi':
          return normalize(subst1(newFunc.body, newArg));
        default:
          return { ...term, func: newFunc, arg: newArg }
      }
    case 'Ann':
      return { ...term, term: normalize(term.term), ty: normalize(term.ty) }
  }
}

export function normalizeAbstraction(term: Term): Term {
  // TODO: Should we normalize here?
  return term;
}