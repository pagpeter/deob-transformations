# Useful babel transformations for deobfuscating javascript

This library contains a number of useful babel transformations, that will make nasty javascript code a lot more readable.

## Example

```js
const transformations = require('deob-transformations');

const code = `
function _aegh(){debugger;};const z = "l";const zz = "o"
const zzz = "g"
;;function _0x1uz(){;;debugger;};if (!![])  {
window["c"+zz+"ns"+zz+z+"e"][z+zz+zzz](z+zz+z);;
};;
`;

ast = transformations.code_to_ast(code);

transformations.delete_unused(ast);
transformations.replace_with_actual_val(ast);
transformations.constant_folding(ast);
transformations.deobfuscate_object_calls(ast);
transformations.deobfuscate_hidden_false(ast);
transformations.remove_useless_if(ast);
transformations.remove_empty_statements(ast);

deobbed = transformations.ast_to_code(ast);
console.log(transformations.beautify_code(deobbed));
```

This example transforms the nasty input javascript into a very readable `window.console.log('lol')`.

## Utilities

### `code_to_ast(string)`

Parses the input code and returns an abstract syntax tree than can be used for the transformations

### `ast_to_code(ast)`

Does the opposite as `code_to_ast`

### `beautify_code(string)`

Beautifys code. Takes a string as the input argument, not an abstract syntax tree

## Available transformations

### `remove_empty_statements(ast)`

Removes empty statements, for example useless semicolons.

### `constant_folding(ast)`

https://steakenthusiast.github.io/2022/05/28/Deobfuscating-Javascript-via-AST-Manipulation-Constant-Folding/#Examples

### `deobfuscate_jsfuck(ast)`

https://steakenthusiast.github.io/2022/06/14/Deobfuscating-Javascript-via-AST-Deobfuscating-a-Peculiar-JSFuck-style-Case/

### `rename_identifiers(ast)`

Rename the arguments of a function to be more uniform and readable. Not always a good transformation to do.

```js
// Before
fun = (rw, srdgb, a3r, s_sar) => {};

// After
fun = (paramA, paramB, paramC, paramD) => {};
```

### `deobfuscate_hidden_false(ast)`

```js
// Before
const a = ![];
const b = !![];

// After
const a = false;
const b = true;
```

This is also being done by the `deobfuscate_jsfuck` transformation.

### `remove_useless_if(ast)`

Removes useless if statements

```js
// Before
if (true) {
  console.log('Hi!');
}

// After
console.log('Hi!');
```

```js
// Before
if (false) {
  console.log('Hi!');
}
console.log('Hey');

// After
console.log('Hey'); // the if statement get's never exucted, so it get's removed
```

This transformation is often useful after other transformation, for example `deobfuscate_hidden_false`

### `remove_hex_numbers(ast)`

```js
// Before
const a = 0x01;
console.log('Hello\x20World');

// After
const a = 1;
console.log('Hello World');
```

### `remove_comma_statements(ast)`

```js
// Before
for (b = 2, c = 5, console.log('123'), a; true; c++) {}

// After
b = 2;
c = 5;
console.log('123');

for (a; true; c++) {}
```

### `replace_with_actual_val(ast)`

https://steakenthusiast.github.io/2022/05/31/Deobfuscating-Javascript-via-AST-Replacing-References-to-Constant-Variables-with-Their-Actual-Value/

Replaces all references to constants with the constant value and removes the constants declaration. If there is no reference, the value gets lost.
This does not include dictionaries or arrays.

```js
// Before
const a = '1';
const b = 'Hi!';
console.log(b);

// After
console.log('Hi!');
```

### `remove_dead_else(ast)`

```js
// Before
if (something) {
  console.log('Hi!');
} else {
}

// After
if (something) {
  console.log('Hi!');
}
```

### `delete_unused(ast)`

https://steakenthusiast.github.io/2022/06/04/Deobfuscating-Javascript-via-AST-Removing-Dead-or-Unreachable-Code/

Deletes all read or unreachable code.

### `deobfuscate_object_calls(ast)`

Uses the dot notation everywhere

```js
// Before
const m = {
  a: 'Hello, World!',
};
console['log'](m['a']);

// After
const m = {
  a: 'Hello, World!',
};
console.log(m.a);
```

### `deobfuscate_cloudflare(ast)`

Custom cloudflare obfuscator, does some more transformations.
