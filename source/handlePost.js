/*!
	POST requests handler
*/

var typs = require('typs');
var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./jsonError.js');
var assertResourceExists = require('./assertResourceExists.js');


var handlePost = function (request, body, context) {
	squel.useFlavour('mysql');

	var objects = body[request.primary.resource];
	objects = typs(objects).array().check()	? objects : [objects];

	return Promise.map(objects, (object) => {
		// prepare the INSERT query
		var query = squel.insert().into(context.resources[request.primary.resource].sql_table);

		// typecheck all the fields
		Object.keys(context.resources[request.primary.resource].structure).forEach((field) => {
			if (field === context.resources[request.primary.resource].keys.primary) return;
			if (typs(object[field]).isnt(context.resources[request.primary.resource].structure[field].type)) {
				throw new jsonError({
					title: 'Bad request',
					detail: 'The value specified for the field \'' + field + '\' doesn\'t typecheck',
					status: 400
				});
			}
		});

		// build the row object
		var row = {};
		Object.keys(object).forEach((field) => {
			row[context.resources[request.primary.resource].structure[field].sql_column] = object[field];
		});
		query = query.setFields(row);
console.log(query.toString());
		return query;
	}).map((query) => context.callQuery(query).reflect()).all().then((stats) => {
		console.log('fulfilled',stats.map((s) => s.isFulfilled()));
		console.log('rejected',stats.map((s) => s.isRejected()));
		var handleGet = require('./handleGet.js');
		var parseUrl = require('./parseUrl.js');

		var ids = stats.filter((stat) => stat.isFulfilled()).map((stat) => stat.value()[0].insertId);
		var errors = stats.map((stat, i) => {
			if (!stat.isRejected()) return null;
			var err = stat.reason();
			err.object.title = '(On request #' + (i + 1) + ') ' + err.object.title;
			return err;
		}).filter((error) => null !== error);

		console.log('ids',ids);
		console.log('errors',errors);

		var promise_result = null;

		// if some resource have been actually created
		if (0 !== ids.length) {
			// URL to the new created resources
			var location = '/' + request.primary.resource + '/' + ids.join(',');

			// immediatly return the documents created (as the spec says)
			promise_result = handleGet(
				parseUrl(location, context),
				null, context
			).then((response) => {
				response.location = location;
				response.status = 201;
				return response;
			});
		} else {
			// no resources created, that's a failure
			promise_result = Promise.resolve({response: {}, status: 400});
		}

		// if there are some errors
		if(0 !== errors.length) {
			promise_result = promise_result.then((response) => {
				if (0 !== errors.length) {
					response.response.errors = errors;
				}
				return response;
			});
		}

		// return the response
		return promise_result;
	});
};

module.exports = handlePost;
