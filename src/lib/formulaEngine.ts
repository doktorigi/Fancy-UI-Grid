export type FormulaAST =
  | { type: 'literal'; value: number | string | boolean | null }
  | { type: 'field'; name: string }
  | { type: 'unary'; op: '+' | '-' | '!'; expr: FormulaAST }
  | {
      type: 'binary';
      op: '+' | '-' | '*' | '/' | '%' | '^' | '&' | '=' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';
      left: FormulaAST;
      right: FormulaAST;
    }
  | { type: 'call'; name: string; args: FormulaAST[] };

export interface CompiledFormula {
  source: string;
  ast: FormulaAST | null;
  error?: string;
  referencedFields: string[];
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'field'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' };

function tokenizeFormula(input: string): Token[] {
  const trimmed = input.trim();
  const body = trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed;
  const tokens: Token[] = [];
  let i = 0;

  while (i < body.length) {
    const ch = body[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Bracketed field reference: [fieldName]
    if (ch === '[') {
      const end = body.indexOf(']', i + 1);
      if (end === -1) {
        throw new Error('Unclosed field bracket "["');
      }
      const fieldName = body.slice(i + 1, end).trim();
      if (!fieldName) {
        throw new Error('Empty field reference "[]"');
      }
      tokens.push({ type: 'field', value: fieldName });
      i = end + 1;
      continue;
    }

    // Quoted string literal: '...' or "..."
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      let closed = false;
      while (i < body.length) {
        if (body[i] === '\\' && i + 1 < body.length) {
          str += body[i + 1];
          i += 2;
          continue;
        }
        if (body[i] === quote) {
          closed = true;
          i++;
          break;
        }
        str += body[i];
        i++;
      }
      if (!closed) {
        throw new Error(`Unclosed string literal (${quote})`);
      }
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Number literal
    if (/\d/.test(ch) || (ch === '.' && i + 1 < body.length && /\d/.test(body[i + 1]))) {
      let numStr = '';
      while (i < body.length && /[\d.]/.test(body[i])) {
        numStr += body[i++];
      }
      if (i < body.length && (body[i] === 'e' || body[i] === 'E')) {
        numStr += body[i++];
        if (i < body.length && (body[i] === '+' || body[i] === '-')) {
          numStr += body[i++];
        }
        while (i < body.length && /\d/.test(body[i])) {
          numStr += body[i++];
        }
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid number "${numStr}"`);
      }
      tokens.push({ type: 'number', value: parsed });
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }

    // Two-character operators
    const twoChar = body.slice(i, i + 2);
    if (['<=', '>=', '!=', '<>', '==', '&&', '||'].includes(twoChar)) {
      const normalized = twoChar === '<>' ? '!=' : twoChar === '==' ? '=' : twoChar;
      tokens.push({ type: 'op', value: normalized });
      i += 2;
      continue;
    }

    // Single-character operators
    if (['+', '-', '*', '/', '%', '^', '&', '=', '<', '>', '!'].includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Identifiers (function names, TRUE/FALSE/NULL, or bare field names)
    if (/[A-Za-z_$]/.test(ch)) {
      let ident = '';
      while (i < body.length && /[A-Za-z0-9_$.]/.test(body[i])) {
        ident += body[i++];
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    throw new Error(`Unexpected character "${ch}" at position ${i + 1}`);
  }

  return tokens;
}

class FormulaParser {
  private pos = 0;
  public referencedFields = new Set<string>();

  constructor(private tokens: Token[]) {}

  parse(): FormulaAST {
    if (this.tokens.length === 0) {
      throw new Error('Formula is empty');
    }
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected trailing tokens in formula');
    }
    return expr;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private matchOp(...ops: string[]): string | null {
    const tok = this.peek();
    if (tok && tok.type === 'op' && ops.includes(tok.value)) {
      this.pos++;
      return tok.value;
    }
    return null;
  }

  private parseOr(): FormulaAST {
    let left = this.parseAnd();
    while (true) {
      const op = this.matchOp('||');
      if (!op) break;
      const right = this.parseAnd();
      left = { type: 'binary', op: '||', left, right };
    }
    return left;
  }

  private parseAnd(): FormulaAST {
    let left = this.parseComparison();
    while (true) {
      const op = this.matchOp('&&');
      if (!op) break;
      const right = this.parseComparison();
      left = { type: 'binary', op: '&&', left, right };
    }
    return left;
  }

  private parseComparison(): FormulaAST {
    let left = this.parseConcat();
    while (true) {
      const op = this.matchOp('=', '!=', '<', '<=', '>', '>=') as
        | '='
        | '!='
        | '<'
        | '<='
        | '>'
        | '>='
        | null;
      if (!op) break;
      const right = this.parseConcat();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseConcat(): FormulaAST {
    let left = this.parseAdditive();
    while (true) {
      const op = this.matchOp('&');
      if (!op) break;
      const right = this.parseAdditive();
      left = { type: 'binary', op: '&', left, right };
    }
    return left;
  }

  private parseAdditive(): FormulaAST {
    let left = this.parseMultiplicative();
    while (true) {
      const op = this.matchOp('+', '-') as '+' | '-' | null;
      if (!op) break;
      const right = this.parseMultiplicative();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): FormulaAST {
    let left = this.parsePower();
    while (true) {
      const op = this.matchOp('*', '/', '%') as '*' | '/' | '%' | null;
      if (!op) break;
      const right = this.parsePower();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parsePower(): FormulaAST {
    const left = this.parseUnary();
    const op = this.matchOp('^');
    if (op) {
      const right = this.parsePower();
      return { type: 'binary', op: '^', left, right };
    }
    return left;
  }

  private parseUnary(): FormulaAST {
    const op = this.matchOp('+', '-', '!') as '+' | '-' | '!' | null;
    if (op) {
      return { type: 'unary', op, expr: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaAST {
    const tok = this.peek();
    if (!tok) {
      throw new Error('Unexpected end of formula');
    }

    if (tok.type === 'number') {
      this.consume();
      return { type: 'literal', value: tok.value };
    }

    if (tok.type === 'string') {
      this.consume();
      return { type: 'literal', value: tok.value };
    }

    if (tok.type === 'field') {
      this.consume();
      this.referencedFields.add(tok.value);
      return { type: 'field', name: tok.value };
    }

    if (tok.type === 'paren' && tok.value === '(') {
      this.consume();
      const expr = this.parseOr();
      const closing = this.peek();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Missing closing parenthesis ")"');
      }
      this.consume();
      return expr;
    }

    if (tok.type === 'ident') {
      this.consume();
      const upper = tok.value.toUpperCase();
      const next = this.peek();

      if (next && next.type === 'paren' && next.value === '(') {
        this.consume(); // consume '('
        const args: FormulaAST[] = [];
        const afterOpen = this.peek();
        if (!(afterOpen && afterOpen.type === 'paren' && afterOpen.value === ')')) {
          while (true) {
            args.push(this.parseOr());
            const sep = this.peek();
            if (sep && sep.type === 'comma') {
              this.consume();
              continue;
            }
            break;
          }
        }
        const closeParen = this.peek();
        if (!closeParen || closeParen.type !== 'paren' || closeParen.value !== ')') {
          throw new Error(`Missing ")" after arguments to ${upper}()`);
        }
        this.consume();
        return { type: 'call', name: upper, args };
      }

      if (upper === 'TRUE') return { type: 'literal', value: true };
      if (upper === 'FALSE') return { type: 'literal', value: false };
      if (upper === 'NULL' || upper === 'NONE') return { type: 'literal', value: null };

      // Bare identifier acts as a field reference
      this.referencedFields.add(tok.value);
      return { type: 'field', name: tok.value };
    }

    throw new Error('Unexpected token in formula');
  }
}

const formulaCache = new Map<string, CompiledFormula>();

export function compileFormula(formula: string): CompiledFormula {
  const cached = formulaCache.get(formula);
  if (cached) return cached;

  try {
    const tokens = tokenizeFormula(formula);
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    const compiled: CompiledFormula = {
      source: formula,
      ast,
      referencedFields: Array.from(parser.referencedFields),
    };
    formulaCache.set(formula, compiled);
    return compiled;
  } catch (err: any) {
    const compiled: CompiledFormula = {
      source: formula,
      ast: null,
      error: err?.message || 'Invalid formula',
      referencedFields: [],
    };
    formulaCache.set(formula, compiled);
    return compiled;
  }
}

export function validateFormula(formula: string): {
  valid: boolean;
  error?: string;
  referencedFields: string[];
} {
  const compiled = compileFormula(formula);
  return {
    valid: !!compiled.ast && !compiled.error,
    error: compiled.error,
    referencedFields: compiled.referencedFields,
  };
}

function toNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  return Number.isNaN(num) ? NaN : num;
}

function toBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0 && !Number.isNaN(val);
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'false' || lower === '0' || lower === '') return false;
    return true;
  }
  return Boolean(val);
}

function isFormulaError(val: any): boolean {
  return typeof val === 'string' && val.startsWith('#') && val.endsWith('!');
}

function evalNode(node: FormulaAST, resolveField: (name: string) => any): any {
  switch (node.type) {
    case 'literal':
      return node.value;

    case 'field':
      return resolveField(node.name);

    case 'unary': {
      const val = evalNode(node.expr, resolveField);
      if (isFormulaError(val)) return val;
      if (node.op === '!') return !toBoolean(val);
      const num = toNumber(val);
      if (Number.isNaN(num)) return '#VALUE!';
      return node.op === '-' ? -num : num;
    }

    case 'binary': {
      if (node.op === '&&') {
        const left = evalNode(node.left, resolveField);
        if (isFormulaError(left)) return left;
        if (!toBoolean(left)) return false;
        const right = evalNode(node.right, resolveField);
        if (isFormulaError(right)) return right;
        return toBoolean(right);
      }
      if (node.op === '||') {
        const left = evalNode(node.left, resolveField);
        if (isFormulaError(left)) return left;
        if (toBoolean(left)) return true;
        const right = evalNode(node.right, resolveField);
        if (isFormulaError(right)) return right;
        return toBoolean(right);
      }

      const left = evalNode(node.left, resolveField);
      if (isFormulaError(left)) return left;
      const right = evalNode(node.right, resolveField);
      if (isFormulaError(right)) return right;

      if (node.op === '&') {
        return `${left ?? ''}${right ?? ''}`;
      }

      if (['=', '!=', '<', '<=', '>', '>='].includes(node.op)) {
        const lNum = typeof left === 'number' ? left : typeof left === 'string' && left.trim() !== '' ? Number(left) : NaN;
        const rNum = typeof right === 'number' ? right : typeof right === 'string' && right.trim() !== '' ? Number(right) : NaN;
        if (!Number.isNaN(lNum) && !Number.isNaN(rNum)) {
          if (node.op === '=') return lNum === rNum;
          if (node.op === '!=') return lNum !== rNum;
          if (node.op === '<') return lNum < rNum;
          if (node.op === '<=') return lNum <= rNum;
          if (node.op === '>') return lNum > rNum;
          if (node.op === '>=') return lNum >= rNum;
        }
        const lStr = String(left ?? '').toLowerCase();
        const rStr = String(right ?? '').toLowerCase();
        if (node.op === '=') return lStr === rStr;
        if (node.op === '!=') return lStr !== rStr;
        if (node.op === '<') return lStr < rStr;
        if (node.op === '<=') return lStr <= rStr;
        if (node.op === '>') return lStr > rStr;
        if (node.op === '>=') return lStr >= rStr;
      }

      // If '+' is used with a non-numeric string, concatenate
      if (node.op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        const lNum = toNumber(left);
        const rNum = toNumber(right);
        if (Number.isNaN(lNum) || Number.isNaN(rNum)) {
          return `${left ?? ''}${right ?? ''}`;
        }
      }

      const a = toNumber(left);
      const b = toNumber(right);
      if (Number.isNaN(a) || Number.isNaN(b)) return '#VALUE!';

      switch (node.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return b === 0 ? '#DIV/0!' : a / b;
        case '%':
          return b === 0 ? '#DIV/0!' : a % b;
        case '^':
          return Math.pow(a, b);
        default:
          return '#ERR!';
      }
    }

    case 'call': {
      const fn = node.name;
      const args = node.args;

      if (fn === 'IF') {
        if (args.length < 2) return '#ERR!';
        const cond = evalNode(args[0], resolveField);
        if (isFormulaError(cond)) return cond;
        if (toBoolean(cond)) {
          return evalNode(args[1], resolveField);
        }
        return args[2] ? evalNode(args[2], resolveField) : null;
      }

      if (fn === 'IFS') {
        for (let i = 0; i + 1 < args.length; i += 2) {
          const cond = evalNode(args[i], resolveField);
          if (isFormulaError(cond)) return cond;
          if (toBoolean(cond)) {
            return evalNode(args[i + 1], resolveField);
          }
        }
        return null;
      }

      if (fn === 'IFERROR') {
        if (args.length < 2) return '#ERR!';
        const primary = evalNode(args[0], resolveField);
        if (
          primary === null ||
          primary === undefined ||
          (typeof primary === 'number' && !Number.isFinite(primary)) ||
          isFormulaError(primary)
        ) {
          return evalNode(args[1], resolveField);
        }
        return primary;
      }

      if (fn === 'COALESCE') {
        for (const arg of args) {
          const val = evalNode(arg, resolveField);
          if (val !== null && val !== undefined && val !== '' && !isFormulaError(val)) {
            return val;
          }
        }
        return null;
      }

      // Evaluate all arguments eagerly for standard functions
      const evaluatedArgs = args.map(arg => evalNode(arg, resolveField));
      const errArg = evaluatedArgs.find(isFormulaError);
      if (errArg) return errArg;

      switch (fn) {
        case 'AND':
          return evaluatedArgs.every(toBoolean);
        case 'OR':
          return evaluatedArgs.some(toBoolean);
        case 'NOT':
          return !toBoolean(evaluatedArgs[0]);
        case 'ISBLANK':
          return evaluatedArgs[0] === null || evaluatedArgs[0] === undefined || evaluatedArgs[0] === '';
        case 'ISNUMBER': {
          const n = toNumber(evaluatedArgs[0]);
          return typeof evaluatedArgs[0] === 'number' ? Number.isFinite(n) : false;
        }
        case 'ROUND': {
          const n = toNumber(evaluatedArgs[0]);
          const digits = evaluatedArgs.length > 1 ? toNumber(evaluatedArgs[1]) : 0;
          if (Number.isNaN(n) || Number.isNaN(digits)) return '#VALUE!';
          const factor = Math.pow(10, digits);
          return Math.round((n + Number.EPSILON) * factor) / factor;
        }
        case 'FLOOR': {
          const n = toNumber(evaluatedArgs[0]);
          return Number.isNaN(n) ? '#VALUE!' : Math.floor(n);
        }
        case 'CEIL':
        case 'CEILING': {
          const n = toNumber(evaluatedArgs[0]);
          return Number.isNaN(n) ? '#VALUE!' : Math.ceil(n);
        }
        case 'ABS': {
          const n = toNumber(evaluatedArgs[0]);
          return Number.isNaN(n) ? '#VALUE!' : Math.abs(n);
        }
        case 'SQRT': {
          const n = toNumber(evaluatedArgs[0]);
          return Number.isNaN(n) || n < 0 ? '#VALUE!' : Math.sqrt(n);
        }
        case 'POW':
        case 'POWER': {
          const base = toNumber(evaluatedArgs[0]);
          const exp = toNumber(evaluatedArgs[1]);
          return Number.isNaN(base) || Number.isNaN(exp) ? '#VALUE!' : Math.pow(base, exp);
        }
        case 'MOD': {
          const a = toNumber(evaluatedArgs[0]);
          const b = toNumber(evaluatedArgs[1]);
          if (Number.isNaN(a) || Number.isNaN(b)) return '#VALUE!';
          return b === 0 ? '#DIV/0!' : a % b;
        }
        case 'MIN': {
          const nums = evaluatedArgs.map(toNumber).filter(n => !Number.isNaN(n));
          return nums.length > 0 ? Math.min(...nums) : null;
        }
        case 'MAX': {
          const nums = evaluatedArgs.map(toNumber).filter(n => !Number.isNaN(n));
          return nums.length > 0 ? Math.max(...nums) : null;
        }
        case 'SUM': {
          const nums = evaluatedArgs.map(toNumber);
          if (nums.some(Number.isNaN)) return '#VALUE!';
          return nums.reduce((acc, v) => acc + v, 0);
        }
        case 'AVG':
        case 'AVERAGE': {
          const nums = evaluatedArgs.map(toNumber).filter(n => !Number.isNaN(n));
          return nums.length > 0 ? nums.reduce((acc, v) => acc + v, 0) / nums.length : null;
        }
        case 'CONCAT':
          return evaluatedArgs.map(v => String(v ?? '')).join('');
        case 'UPPER':
          return String(evaluatedArgs[0] ?? '').toUpperCase();
        case 'LOWER':
          return String(evaluatedArgs[0] ?? '').toLowerCase();
        case 'TRIM':
          return String(evaluatedArgs[0] ?? '').trim();
        case 'LEN':
          return String(evaluatedArgs[0] ?? '').length;
        case 'LEFT': {
          const s = String(evaluatedArgs[0] ?? '');
          const count = evaluatedArgs.length > 1 ? Math.max(0, toNumber(evaluatedArgs[1])) : 1;
          return Number.isNaN(count) ? '#VALUE!' : s.slice(0, count);
        }
        case 'RIGHT': {
          const s = String(evaluatedArgs[0] ?? '');
          const count = evaluatedArgs.length > 1 ? Math.max(0, toNumber(evaluatedArgs[1])) : 1;
          if (Number.isNaN(count)) return '#VALUE!';
          return count === 0 ? '' : s.slice(-count);
        }
        default:
          return '#NAME?';
      }
    }
  }
}

function readRowPath(row: Record<string, any>, field: string): any {
  if (!row) return undefined;
  if (field in row) return row[field];
  if (field.includes('.')) {
    return field.split('.').reduce((acc: any, part) => (acc != null ? acc[part] : undefined), row);
  }
  return undefined;
}

export function evaluateCompiledFormula(
  compiled: CompiledFormula,
  row: Record<string, any>,
  formulaMap?: Map<string, CompiledFormula>,
  visiting?: Set<string>
): any {
  if (!compiled.ast || compiled.error) return '#ERR!';

  const resolveField = (name: string): any => {
    if (formulaMap && formulaMap.has(name)) {
      const seen = visiting ?? new Set<string>();
      if (seen.has(name)) {
        return '#CYCLE!';
      }
      const nextSeen = new Set(seen);
      nextSeen.add(name);
      return evaluateCompiledFormula(formulaMap.get(name)!, row, formulaMap, nextSeen);
    }
    return readRowPath(row, name);
  };

  try {
    return evalNode(compiled.ast, resolveField);
  } catch {
    return '#ERR!';
  }
}

export function evaluateFormula(formula: string, row: Record<string, any>): any {
  const compiled = compileFormula(formula);
  return evaluateCompiledFormula(compiled, row);
}

export function applyFormulaColumnsToRows<TData extends Record<string, any>>(
  rows: TData[],
  formulaColumns: { field: string; formula: string }[],
  isTreeData = false
): TData[] {
  if (!rows || rows.length === 0 || formulaColumns.length === 0) {
    return rows;
  }

  const formulaMap = new Map<string, CompiledFormula>();
  for (const col of formulaColumns) {
    if (col.field && col.formula) {
      formulaMap.set(col.field, compileFormula(col.formula));
    }
  }

  if (formulaMap.size === 0) return rows;

  const transformRow = (row: TData): TData => {
    const clone: Record<string, any> = { ...row };
    for (const [field, compiled] of formulaMap.entries()) {
      const visiting = new Set<string>([field]);
      clone[field] = evaluateCompiledFormula(compiled, clone, formulaMap, visiting);
    }
    if (isTreeData && Array.isArray(row.children) && row.children.length > 0) {
      clone.children = row.children.map((child: TData) => transformRow(child));
    }
    return clone as TData;
  };

  return rows.map(transformRow);
}

export function slugifyFormulaField(headerText: string, existingFields: Iterable<string>): string {
  const baseSlug = headerText
    .trim()
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const prefix = baseSlug ? `calc_${baseSlug}` : 'calc_column';
  const taken = new Set(existingFields);
  if (!taken.has(prefix)) return prefix;
  let counter = 2;
  while (taken.has(`${prefix}_${counter}`)) {
    counter++;
  }
  return `${prefix}_${counter}`;
}
