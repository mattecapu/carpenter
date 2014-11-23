/*!
	exposeAPI()
	return a function that consumes an URL and a body and returns a response
*/

var typs = require('typs');
var Promise = require('bluebird');

var parseUrl = require('./parseUrl.js');
var validateResourceRequest = require('./validateResourceRequest.js');
var jsonError = require('./error.js');

var handlers = {
	'GET': require('./handleGet.js'),
	'POST': require('./handlePost.js'),
	'PUT': require('./handlePut.js'),
	'DELETE': require('./handleDelete.js')
};

module.exports = function(stringify, context) {
	return function(url, method, body) {
		method = method.toUpperCase();

		try {
			if (!typs(body).notNull().object().notEmpty().check() && method === 'POST' && method === 'PUT') {
				throw new jsonError({
					title: 'Bad request',
					detail: method + ' requests require a non-empty JSON object as the request body',
					status: 400
				});
			}

			var request = parseUrl(url, context);

			validateResourceRequest(request.primary);
			if (request.linked.length) {
				request.linked.forEach(validateResourceRequest);
			}

			return handlers[method](request, body, context).then(function({response, status}) {
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
