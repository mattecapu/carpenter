/*!
	PUT requests handler
*/


var typs = require('typs');
var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./jsonError.js');


var handlePut = function (request, body, context) {
	squel.useFlavour('mysql');

	var objects = body[request.primary.resource];
	objects = typs(objects).array().check()	? objects : [objects];

	if (request.primary.ids.length !== objects.length) {
		throw new jsonError({
			title: 'Bad request',
			detail: 'All the IDs of the resources to update must be specified in the request URL',
			status: 400
		});
	}

	return Promise.map(objects, (object, i) => {
		// prepare the INSERT query
		var query = squel.update().table(context.resources[request.primary.resource].sql_table);

		// typecheck all the fields
		Object.keys(object).forEach((field) => {
			if (typs(object[field]).isnt(context.resources[request.primary.resource].structure[field].type)) {
				throw new jsonError({
					title: 'Bad request',
					detail: 'The value specified for the field \'' + field + '\' doesn\'t typecheck',
					status: 400
				});
			}

			if (field === context.resources[request.primary.resource].keys.primary) {
				if (-1 === request.primary.ids.indexOf(object[field])) {
					throw new jsonError({
						title: 'Bad request',
						detail: 'The ID of resource #' + (i + 1) + ' must be specified in the request URL',
						status: 400
					});
				}
			}
		});

		// build the row object
		var row = {};
		Object.keys(object).forEach((field) => {
			if (field === context.resources[request.primary.resource].keys.primary) return;
			row[context.resources[request.primary.resource].structure[field].sql_column] = object[field];
		});
		query = query.setFields(row).where(
			context.resources[request.primary.resource].keys.primary + ' = ?',
			object[context.resources[request.primary.resource].keys.primary]
		);

		return query;

	}).then((queries) => {
		// simulates a squel query
		context.callQuery({
			toParam: () => {
				return {text: 'START TRANSACTION', values: []};
			}
		});
		return queries;
	}).map((query) => context.callQuery(query)).all().then((stats) => {
		// simulates a squel query
		context.callQuery({
			toParam: () => {
				return {text: 'COMMIT', values: []};
			}
		});
		return {response: {}, status: 204};
	});
};

module.exports = handlePut;
