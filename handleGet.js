/*!
	GET requests handler
*/

var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./error.js');

var buildQuery = function(resource_request, context) {
	var main_query = squel.select().from(context.resources[resource_request.resource].sql_table);
	main_query = resource_request.fields.reduce((query, field) => {
		return query.field(context.resources[resource_request.resource].structure[field].sql_column);
	}, main_query);
	main_query = resource_request.filters.reduce((query, {field, values}) => {
		return query.where(context.resources[resource_request.resource].structure[field].sql_column + ' IN (?)', values.join(','));
	}, main_query);

	if(resource_request.superset_from) {
		main_query = main_query
						.where(
							context.resources[resource_request.resource].keys.primary + ' IN (?)',
							squel.select()
								.field(context.resources[resource_request.superset_from.resource].structure[resource_request.superset_from.foreign.field].sql_column)
								.from(context.resources[resource_request.superset_from.resource].sql_table)
								.where(
									context.resources[resource_request.superset_from.resource].keys.primary + ' IN (?)',
									resource_request.superset_from.ids.join(',')
								)
						);
	}

	main_query = resource_request.sorters.forEach((query, {field, asc}) => {
		return query.order(context.resources[resource_request.resource].structure[field].sql_column, asc);
	}, main_query);
	return main_query;
}

module.exports = function (request, body, context) {

	var primary_query = buildQuery(request.primary, context);
	var linked_queries = request.linked.map((linked) => buildQuery(linked, context));

	var promises = linked_queries.map((linked_query) => {
		return new Promise((res, rej) => {
			if (linked_query === null) {
				res(null);
				return;
			}
			context.db_connection.query(linked_query.text, linked_query.values, function(rows, stats) {
				res({rows, stats});
			});
		});
	});
	promises.unshift(new Promise((res, rej) => {
		primary_query = primary_query.toParam();
		context.db_connection.query(primary_query.text, primary_query.values, function(rows, stats) {
			res({rows, stats});
		});
	}));

	return Promise.all(promises).then((results) => {
		var response = {};

		response[request.primary.resource] = results[0].rows.length > 1 ? results[0].rows : results[0].rows[0];

		results.shift();
		if (results.length) {
			response.linked = {};
			results.forEach((result, i) => {
				response.linked[request.linked[i].resource] = results[i].rows.length > 1 ? results[i].rows : results[i].rows[0];
			});
		}

		return {response, status: 200};
	});
};
