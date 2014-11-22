/*!
	exposeAPI()
	return a function that consumes an URL and a body and returns a response
*/

var typs = require('typs');
var Promise = require('bluebird');

var parseUrl = require('./parseUrl.js');
var jsonError = require('./error.js');

var handlers = {
	'GET': require('./handleGet.js'),
	'POST': require('./handlePost.js'),
	'PUT': require('./handlePut.js'),
	'DELETE': require('./handleDelete.js')
};

module.exports = function(stringify, context) {
	return function(url, method, body) {

		var response = null;
		method = method.toUpperCase();

		try {

			if (!typs(body).notNull().object().notEmpty().check() && method === 'POST' && method === 'PUT') {
				throw new jsonError({
					title: 'Bad Request',
					detail: method + ' method requires a non-empty JSON object',
					status: 400
				});
			}

			return handlers[method](parseUrl(url), body, context).then(({response, status}) => {
				if (stringify) response = JSON.stringify(response);
				return {response, status};
			});

		} catch (error) {
			if (error instanceof Error) {
				error = new jsonError({
					detail: error.message
				});
			} else if (!(error instanceof jsonError)) {
				error = new jsonError({});
			}
			return Promise.resolve({response: {error}, status: error.status});
		}
	};
};
