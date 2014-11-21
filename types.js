/*!
	Types
	collection of common types
*/

var typs = require('typs');

var types = {
	id: typs().integer().positive().notZero()
};

module.exports = types;
