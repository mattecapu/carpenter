/*!
	Check the existence of a resource, and throw if it doesn't exist
*/


var typs = require('typs');
var jsonError = require('./jsonError.js');


var assertResourceExists = function (resource, context) {
	if (typs(context.resources[resource]).Null().check()) {
		throw new jsonError({
			title: 'Resource not found',
			detail: '\'' + resource + '\' doesn\'t exist',
			status: 404
		});
	}
};

module.exports = assertResourceExists;
