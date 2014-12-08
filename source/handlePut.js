/*!
	PUT requests handler
*/


var typs = require('typs');
var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./jsonError.js');
var {filterBy, selectBy} = require('./queryBuilder.js');


var handlePut = function (request, body, context) {
	squel.useFlavour('mysql');

	var objects = body[request.primary.resource];
	objects = typs(objects).array().check()	? objects : [objects];

	return context.callQuery(
		selectBy(request.primary, context)
	).spread((rows) => rows.length > 1).then((check_ids) => {
		// if the two differ, something is missing
		request.primary.ids = request.primary.ids || [];
		if (check_ids && request.primary.ids.length !== objects.length) {
			throw new jsonError({
				title: 'Bad request',
				detail: 'All the IDs of the resources to update must be specified both in the URL and in the body',
				status: 400
			});
		}

		return Promise.map(objects, (object, i) => {
			// prepare the INSERT query
			var query = squel.update().table(context.resources[request.primary.resource].sql_table);
			var new_fields = Object.keys(object);
			var primary_key_field = context.resources[request.primary.resource].keys.primary;

			// typecheck all the fields
			new_fields.forEach((field) => {
				if (typs(object[field]).isnt(context.resources[request.primary.resource].structure[field].type)) {
					throw new jsonError({
						title: 'Bad request',
						detail: 'The value specified for the field \'' + field + '\' doesn\'t typecheck',
						status: 400
					});
				}
			});

			if (check_ids) {
				// check if we have all the necessary IDs
				if (typs(object[primary_key_field]).Null().check()) {
					throw new jsonError({
						title: 'Bad request',
						detail: 'The ID of resource #' + (i + 1) + ' must be specified',
						status: 400
					});
				} else if (-1 === request.primary.ids.indexOf(object[primary_key_field])) {
					throw new jsonError({
						title: 'Bad request',
						detail: 'The ID of resource #' + (i + 1) + ' must be specified in the request URL',
						status: 400
					});
				}
			}

			// build the row object
			var row = {};
			new_fields.filter((f) => f !== primary_key_field).forEach((field) => {
				row[context.resources[request.primary.resource].structure[field].sql_column] = object[field];
			});
			if (typs(row).notEmpty().doesntCheck()) {
				return null;
			} else {
				// we use filterBy to support complex requests
				query = filterBy(query.setFields(row), request.primary, context);

				// filter by ID if it's needed
				if (check_ids) {
					query = query.where(primary_key_field + ' = ?', object[primary_key_field]);
				}

				return query;
			}
		});
	}).catch((x) => {
		throw x;
	}).then((queries) => {
		context.callQuery('START TRANSACTION');
		return queries;
	}).map((query) => context.callQuery(query)).all().then((stats) => {
		context.callQuery('COMMIT');
		return {response: {}, status: 204};
	}).catch((error) => {
		context.callQuery('ROLLBACK');
		throw error;
	});
};

module.exports = handlePut;
