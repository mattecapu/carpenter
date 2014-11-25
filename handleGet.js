/*!
	GET requests handler
*/

var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./jsonError.js');

var buildQuery = function(resource_request, context) {
	var main_query = squel.select().from(context.resources[resource_request.resource].sql_table, resource_request.resource);

	main_query = resource_request.fields.reduce((query, field) => {
		return query.field(context.resources[resource_request.resource].structure[field].sql_column, field);
	}, main_query);
	main_query = resource_request.filters.reduce((query, {field, values}) => {
		return query.where(context.resources[resource_request.resource].structure[field].sql_column + ' IN ?', values);
	}, main_query);

	if(resource_request.superset) {
		resource_request.superset.request.fields = [resource_request.superset.foreign.field];
		main_query = main_query.where(
			context.resources[resource_request.resource].keys.primary + ' IN ?',
			buildQuery(resource_request.superset.request, context)
		);
	}

	main_query = resource_request.sorters.reduce((query, {field, asc}) => {
		return query.order(context.resources[resource_request.resource].structure[field].sql_column, asc);
	}, main_query);

	return main_query;
};

module.exports = function (request, body, context) {

	var primary_query = buildQuery(request.primary, context);
	var linked_queries = request.linked.map((linked) => buildQuery(linked, context));

	var bit_casting = function (field, next) {
		// handle only BIT(1)
		if (field.type == "BIT" && field.length == 1) {
			var bit = field.string();
			return (bit === null) ? null : bit.charCodeAt(0);
		}
		// handle everything else as default
		return next();
	};

	var promises = linked_queries.map((linked_query) => {
		return new Promise((res, rej) => {
			if (linked_query === null) {
				res(null);
				return;
			}
			linked_query = linked_query.toParam();
			context.db_connection.query({sql: linked_query.text, typeCast: bit_casting}, linked_query.values, function(err, rows) {
				err ? rej(err) : res({rows});
			});
		});
	});
	promises.unshift(new Promise((res, rej) => {
		primary_query = primary_query.toParam();
		context.db_connection.query({sql: primary_query.text, typeCast: bit_casting}, primary_query.values, function(err, rows) {
			err ? rej(err) : res({rows});
		});
	}));

	return Promise.all(promises).then((results) => {
		var response = {};

		if (0 === results[0].rows.length) return {response, status: 404}

		response[request.primary.resource] = results[0].rows.length > 1 ? results[0].rows : results[0].rows[0];

		if (results.length > 1) {
			results.shift();

			response.linked = {};
			results.forEach((result, i) => {
				if (0 === results[i].rows.length) return;
				response.linked[request.linked[i].resource] = results[i].rows.length > 1 ? results[i].rows : results[i].rows[0];
			});
		}

		return {response, status: 200};
	});
};
