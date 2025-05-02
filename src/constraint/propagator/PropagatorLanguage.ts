import { alt, apply, buildLexer, expectSingleResult, kmid, Lexer, list_sc, lrec_sc, Parser, rule, seq, str, tok, Token, TokenPosition } from "typescript-parsec"; // Added kmid
import { CellRef, known, PropagatorNetwork } from "./Propagator";
import { add, addList, divNumber, equal, getCellRef, maxList, minList, multNumber, negate, PExpr, sub } from "./PropagatorExpr";
import { addRangePropagator, between, divNumericRangeNumberPropagator, exactly, lessThanEqualPropagator, maxRangeListPropagator, minRangeListPropagator, multNumericRangeNumber, multNumericRangeNumberPropagator, NumericRange, subtractRangePropagator } from "./NumericRange";
import { subtract, toNumber } from "lodash";

enum TokenKind {
  Number,
  Add,
  Sub,
  Equal,
  LessThanEqual,
  AddList,
  MaxList,
  MinList,
  MulNum,
  DivNum,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Comma,
  Space,
  VarIdentifier,
}

type PropagatorRelation =
  (net: PropagatorNetwork<NumericRange>) => void;

function concatToken<A>(a: Token<A> | undefined, b: Token<A>): Token<A> {
  if (!a) {
    return b;
  }

  return {
    ...a,
    next: concatToken(a.next, b),
  }
}

const basicLexer = buildLexer<TokenKind>([
  [false, /^\s+/g, TokenKind.Space],
  [true, /^[0-9]+/g, TokenKind.Number],
  [true, /^\+/g, TokenKind.Add],
  [true, /^=/g, TokenKind.Equal],
  [true, /^<=/g, TokenKind.LessThanEqual],
  [true, /^\-/g, TokenKind.Sub],
  [true, /^\(/g, TokenKind.LParen],
  [true, /^\)/g, TokenKind.RParen],
  [true, /^max/g, TokenKind.MaxList],
  [true, /^min/g, TokenKind.MinList],
  [true, /^add/g, TokenKind.AddList],
  [true, /^\*/g, TokenKind.MulNum],
  [true, /^\//g, TokenKind.DivNum],
  [true, /^\[/g, TokenKind.LBracket],
  [true, /^\]/g, TokenKind.RBracket],
  [true, /^,/g, TokenKind.Comma],
])

interface VarIdentifierToken extends Token<TokenKind.VarIdentifier> {
  cellRef?: CellRefs
}

class Tokenizer {
  private _index: number = 0;
  private _inputCellIndex: number = 0;

  constructor(
    private _inputStrings: string[],
    private _inputCells: CellRefs[],
  ) { }

  private buildCellToken(cell: CellRefs, index: number): VarIdentifierToken {
    const pos: TokenPosition = { index, rowBegin: 0, columnBegin: 0, rowEnd: 0, columnEnd: 0 };
    const text = `$${index}`
    return { kind: TokenKind.VarIdentifier, text, pos, next: undefined, cellRef: cell };
  }

  tokenize(): Token<TokenKind> | undefined {
    let head: Token<TokenKind> | undefined = undefined;

    for (let i = 0; i < this._inputStrings.length; i++) {
      const strPart = this._inputStrings[i];
      if (strPart && strPart.length > 0) {
        const stringTokens = basicLexer.parse(strPart);

        if (!stringTokens) {
          throw new Error(`Failed to tokenize string part: ${strPart}`);
        }

        head = concatToken(head, stringTokens);
      }

      if (i < this._inputCells.length) {
        const cell = this._inputCells[i];
        if (!cell) {
          throw new Error(`Cell reference not found for index: ${i}`);
        }
        const cellToken = this.buildCellToken(cell, i);
        head = concatToken(head, cellToken);
      }
    }
    return head;
  }
}

type TokenData =
  | { kind: 'PExprData'; pExpr: PExpr }
  | { kind: 'NumberData'; number: number }
  | { kind: 'ListData'; pExprList: PExpr[] }
  | { kind: 'RangeData'; range: [number, number] }

class PropagatorLanguage {
  constructor(
    private _net: PropagatorNetwork<NumericRange>,
    private _originalStrings: string[],
    private _originalCellRefs: CellRefs[],
    private _constraintName: string,
  ) {
    this.applyBinary = this.applyBinary.bind(this);
    this.applyUnary = this.applyUnary.bind(this);
    this.applyEqual = this.applyEqual.bind(this);
    this.applyLessThanEqual = this.applyLessThanEqual.bind(this);
    this.applyCellRef = this.applyCellRef.bind(this);
    this.applyNumber = this.applyNumber.bind(this);
    this.applyRangeLiteral = this.applyRangeLiteral.bind(this);

    // REL =
    // | COMPOUND_EXPR '=' EXPR
    // | EXPR '=' COMPOUND_EXPR
    // | EXPR '<=' EXPR
    this.REL.setPattern(
      alt(
        apply(seq(this.EXPR, tok(TokenKind.Equal), this.EXPR), this.applyEqual),
        apply(seq(this.EXPR, tok(TokenKind.LessThanEqual), this.EXPR), this.applyLessThanEqual),
      )
    )

    this.ATOM.setPattern(
      alt(
        apply(this.varIdentifierParser, this.applyCellRef),
        apply(tok(TokenKind.Number), this.applyNumber),
        apply(
          seq(
            tok(TokenKind.LBracket),
            tok(TokenKind.Number),
            tok(TokenKind.Comma),
            tok(TokenKind.Number),
            tok(TokenKind.RBracket)
          ),
          this.applyRangeLiteral
        ),
        // Unary negation
        apply(seq(tok(TokenKind.Sub), this.ATOM), ([op, data]) => this.applyUnary(op, data)),

        // Keep function calls in ATOM so they can be part of expressions
        apply(seq(tok(TokenKind.AddList), this.argParser),
          ([op, placeholderToken]) => this.applyUnary(op, this.applyCellRef(placeholderToken))),
        apply(seq(tok(TokenKind.MaxList), this.argParser),
          ([op, placeholderToken]) => this.applyUnary(op, this.applyCellRef(placeholderToken))),
        apply(seq(tok(TokenKind.MinList), this.argParser),
          ([op, placeholderToken]) => this.applyUnary(op, this.applyCellRef(placeholderToken))),

        // Parentheses for grouping expressions
        kmid(tok(TokenKind.LParen), this.EXPR, tok(TokenKind.RParen))
      )
    );

    // EXPR = ATOM (binOp ATOM)*
    this.EXPR.setPattern(
      lrec_sc(this.ATOM, seq(this.binOp, this.ATOM), this.applyBinary)
    );
  }

  applyCellRef(token: Token<TokenKind.VarIdentifier>): TokenData {
    const varToken = token as VarIdentifierToken;
    if (varToken.cellRef !== undefined) {
      // If the tokenizer attached a CellRef, create a PExpr function that returns it.
      const knownCellRef = varToken.cellRef;
      if (Array.isArray(knownCellRef)) {
        return { kind: 'ListData', pExprList: knownCellRef.map((cell) => (net) => cell) };
      }
      const pExprFunc: PExpr = (net) => knownCellRef; // Wrap the known CellRef in a function
      return { kind: 'PExprData', pExpr: pExprFunc };
    } else {
      // Fallback for parsing strings without template literals or if cellRef is missing.
      // Try converting the text to a number first.
      const cellId = toNumber(token.text);
      if (!isNaN(cellId)) {
        // If it's a valid number, create a PExpr function that returns it.
        const knownCellRef = cellId as CellRef;
        const pExprFunc: PExpr = (net) => knownCellRef;
        return { kind: 'PExprData', pExpr: pExprFunc };
      }
      throw new Error(`Invalid cell reference: ${token.text}`);
    }
  }

  applyNumber(token: Token<TokenKind.Number>): TokenData {
    return { kind: 'NumberData', number: parseInt(token.text) };
  }

  applyRangeLiteral(
    sequence: [Token<TokenKind.LBracket>, Token<TokenKind.Number>, Token<TokenKind.Comma>, Token<TokenKind.Number>, Token<TokenKind.RBracket>]
  ): TokenData {
    const min = parseInt(sequence[1].text);
    const max = parseInt(sequence[3].text);
    if (isNaN(min) || isNaN(max)) {
      throw new Error(`Invalid numbers in range literal: [${sequence[1].text}, ${sequence[3].text}]`);
    }
    if (min > max) {
      throw new Error(`Invalid range: minimum ${min} is greater than maximum ${max}`);
    }
    return { kind: 'RangeData', range: [min, max] };
  }

  applyLessThanEqual(sequence: [TokenData, Token<TokenKind.LessThanEqual>, TokenData]): PropagatorRelation {
    const [first, token, second] = sequence;

    const firstPExpr = getPExpr(first);
    const secondPExpr = getPExpr(second);

    return (net: PropagatorNetwork<NumericRange>) => {
      return lessThanEqualPropagator(
        this.label(),
        net,
        getCellRef(net, firstPExpr),
        getCellRef(net, secondPExpr),
      );
    }
  }

  applyEqual(sequence: [TokenData, Token<TokenKind.Equal>, TokenData]): PropagatorRelation {
    const [first, token, second] = sequence;

    if (token.kind !== TokenKind.Equal) {
      throw new Error(`Expected equal token, got: ${token.kind}`);
    }

    const firstPExpr = getPExpr(first);
    const secondPExpr = getPExpr(second);

    return equal(firstPExpr, secondPExpr, this.label());
  }

  applyBinary(first: TokenData, second: [Token<TokenKind>, TokenData]): TokenData {
    const [token, secondData] = second;

    const firstPExpr = getPExpr(first);
    const secondPExpr = getPExpr(secondData);

    switch (token.kind) {
      case TokenKind.Add:
        return this.pExprTokenData(add(firstPExpr, secondPExpr, this.label()));
      case TokenKind.Sub:
        return this.pExprTokenData(sub(firstPExpr, secondPExpr, this.label()));
      case TokenKind.MulNum:
        if (secondData.kind === 'NumberData') {
          return this.pExprTokenData(multNumber(firstPExpr, secondData.number, this.label()));
        }
        throw new Error(`Unsupported second operand for MulNum: ${secondData.kind}`);
      case TokenKind.DivNum:
        if (secondData.kind === 'NumberData') {
          return this.pExprTokenData(divNumber(firstPExpr, secondData.number, this.label()));
        }
        throw new Error(`Unsupported second operand for DivNum: ${secondData.kind}`);
      default:
        throw new Error(`Unsupported binary operation token: ${token.kind}`);
    }
  }

  applyUnary(token: Token<TokenKind>, data: TokenData): TokenData {
    switch (token.kind) {
      case TokenKind.Sub: // Negation
        // getPExpr will handle PExprData, NumberData, RangeData and throw for ListData
        return this.pExprTokenData(negate(getPExpr(data), this.label()));

      // Handle list-based functions (add, max, min)
      case TokenKind.AddList:
      case TokenKind.MaxList:
      case TokenKind.MinList:
        // Expecting data to be the result of applyCellRef($placeholder)
        if (data.kind !== 'ListData') {
          // This means the placeholder $N didn't correspond to a CellRef[] argument
          throw new Error(`Argument for ${token.text}() must be a list placeholder (like $1 representing CellRef[]), but received a single value/expression.`);
        }
        // data is { kind: 'ListData', pExprList: [...] }
        const pExprArgs = data.pExprList; // Extract the list

        if (pExprArgs.length === 0) {
          // This could happen if an empty array was passed as argument
          throw new Error(`List argument for ${token.text}() cannot be empty.`);
        }

        // Call the corresponding programmatic PExpr function
        switch (token.kind) {
          case TokenKind.AddList: return this.pExprTokenData(addList(pExprArgs, this.label()));
          case TokenKind.MaxList: return this.pExprTokenData(maxList(pExprArgs, this.label()));
          case TokenKind.MinList: return this.pExprTokenData(minList(pExprArgs, this.label()));
        }
        break; // Unreachable

      default:
        throw new Error(`Unsupported token kind passed to applyUnary: ${token.kind}`);
    }
    throw new Error(`Internal error: Unhandled case in applyUnary for token kind: ${token.kind}`);
  }

  pExprTokenData(pExpr: PExpr): TokenData {
    return { kind: 'PExprData', pExpr };
  }

  private getName(): string {
    return `[${this._constraintName}]: `;
  }

  private propagatorInfo(): string {
    let result = "";
    const numStrings = this._originalStrings.length;
    const numCells = this._originalCellRefs.length;

    for (let i = 0; i < numStrings; i++) {
      result += this._originalStrings[i];
      if (i < numCells) {
        result += this.showCellRefs(this._originalCellRefs[i]!)
      }
    }
    return this.getName() + result;
  }

  private showCellRefs(cellRefs: CellRefs): string {
    if (Array.isArray(cellRefs)) {
      return cellRefs.map((cellRef) => this._net.cellDescription(cellRef)).join(", ");
    }
    return this._net.cellDescription(cellRefs);
  }

  private label(): string {
    return this.propagatorInfo()
  }

  public readonly EXPR = rule<TokenKind, TokenData>();
  public readonly REL = rule<TokenKind, PropagatorRelation>();
  private readonly ATOM = rule<TokenKind, TokenData>();

  private readonly binOp: Parser<TokenKind, Token<TokenKind>> =
    alt(
      tok(TokenKind.Add),
      tok(TokenKind.Sub),
      tok(TokenKind.MulNum),
      tok(TokenKind.DivNum)
    );

  private readonly varIdentifierParser: Parser<TokenKind, Token<TokenKind.VarIdentifier>> = tok(TokenKind.VarIdentifier);

  private readonly argParser = kmid(tok(TokenKind.LParen), this.varIdentifierParser, tok(TokenKind.RParen))
}

export type CellRefs = CellRef | CellRef[];

export class PropagatorInterpreter {
  constructor(
    private _net: PropagatorNetwork<NumericRange>,
    private _constraintName: string,
  ) { }

  get net(): PropagatorNetwork<NumericRange> {
    return this._net;
  }

  public expr(input: TemplateStringsArray, ...inputCells: CellRefs[]) {
    const inputArray = Array.from(input.values());
    const tokenizer = new Tokenizer(inputArray, inputCells);
    const tokens = tokenizer.tokenize();
    if (!tokens) {
      throw new Error("Lexing failed: No tokens produced.");
    }

    const lang = new PropagatorLanguage(this._net, inputArray, inputCells, this._constraintName);
    const parseResult = lang.EXPR.parse(tokens);

    return runPExpr(this._net, getPExpr(expectSingleResult(parseResult)));
  }

  public addRelation(input: TemplateStringsArray, ...inputCells: CellRefs[]) {
    const inputArray = Array.from(input.values());
    const tokenizer = new Tokenizer(inputArray, inputCells);
    const tokens = tokenizer.tokenize();
    if (!tokens) {
      throw new Error("Lexing failed: No tokens produced.");
    }

    const lang = new PropagatorLanguage(this._net, inputArray, inputCells, this._constraintName);
    const parseResult = lang.REL.parse(tokens);

    return expectSingleResult(parseResult)(this._net);
  }
}

function runPExpr(net: PropagatorNetwork<NumericRange>, expr: PExpr): PropagatorRelation {
  return (net) => {
    const cellRef = getCellRef(net, expr);
    return cellRef;
  }
}

function getPExpr(tokenData: TokenData): PExpr {
  switch (tokenData.kind) {
    case 'PExprData':
      return tokenData.pExpr;
    case 'NumberData':
      return (net) => {
        return net.newCell(tokenData.number.toString(), known(exactly(tokenData.number)));
      }
    case 'RangeData':
      return (net) => {
        return net.newCell(`[${tokenData.range[0]},${tokenData.range[1]}]`, known(between(tokenData.range[0], tokenData.range[1])));
      }
    case 'ListData':
      throw new Error(`ListData is not supported in this context`);
    default:
      const exhaustiveCheck: never = tokenData;
      throw new Error(`Unsupported token data kind: ${(exhaustiveCheck as any)?.kind}`);
  }
}