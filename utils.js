const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const beautify = require('js-beautify');

const code_to_ast = (code) => {
    return parser.parse(code);
}

const ast_to_code = (ast, comments=true) => {
    return generate(ast, { comments: comments }).code;
}

const beautify_code = (code)  => {
    return beautify(code, {
        indent_size: 2,
        space_in_empty_paren: true,
    });
}

module.exports = {
	code_to_ast, 
	ast_to_code, 
	beautify_code
}
