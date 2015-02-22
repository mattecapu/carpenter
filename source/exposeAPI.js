/*!
	exposeAPI()
	returns a function that consumes an URL and a body and returns a response
*/


var typs = require('typs');
var Promise = require('bluebird');

var parseUrl = require('./parseUrl.js');
var validateResourceRequest = require('./validateResourceRequest.js');
var jsonError = require('./jsonError.js');

var handlers = {
	'GET': require('./handleGet.js'),
	'POST': require('./handlePost.js'),
	'PUT': require('./handlePut.js'),
	'DELETE': require('./handleDelete.js')
};


var exposeAPI = function (context) {
	// handler function
	return function (url, method, body) {

		method = method.toUpperCase();

		return Promise.try(() => {

			// check if it's a PUT/POST request, and thus requires a body
			if (typs(body).notNull().object().notEmpty().doesntCheck() && (method === 'POST' || method === 'PUT')) {
				throw new jsonError({
					title: 'Bad request',
					detail: method + ' requests require a non-empty JSON object as the request body',
					status: 400
				});
			}

			// parse the request URL and builds an intermediate representation
			// (a request object)
			var request = parseUrl(url, context);

			// empty request? empty response!
			if (typs(request).Null().check()) return Promise.resolve({response: {}, status: 404});

			// let's check it's all ok with the request
			validateResourceRequest(request.primary, context);
			request.linked.forEach((linked) => validateResourceRequest(linked, context));

			// is method supported by the primary resource? we hope so
			if (-1 === context.resources[request.primary.resource].methods.indexOf(method)) {
				throw new jsonError({
					title: 'Method not supported',
					detail: method + ' requests are not supported for this end-point',
					status: 405
				});
			}

			// pass the request object to a method-specific handler
			return handlers[method](request, body, context);
		}).then(({response, location, status}, x)  => {
			return {response, location, status};
		}).catch((error) => {
			if (error instanceof Error) {
				error = new jsonError({
					title: 'Unexpected error',
					detail: error.message,
					status: 500
				});
			} else if (!(error instanceof jsonError)) {
				error = new jsonError({
					title: 'Unknown error',
					status: 500
				});
			}
			return {
				response: {errors: error.object},
				status: error.object.status
			};
		});
	};
};

module.exports = exposeAPI;
