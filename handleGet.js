/*!
	GET requests handler
*/

var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./error.js');

module.exports = function (url_parsed, body, context) {

	var primary_query = squel.select();
	var linked_queries = [];

	primary_query = primary_query.from(context.resources[url_parsed.primary.resource].table);
	primary_query = url_parsed.primary.fields.reduce((query, field) => {
		return query.field(field);
	}, primary_query);
	primary_query = url_parsed.primary.filters.reduce((query, {field, values}) => {
		return query.where(field + ' IN (?)', values.join(','));
	}, primary_query);
	primary_query = url_parsed.primary.sorters.forEach((query, {field, asc}) => {
		return query.order(field, asc);
	}, primary_query);

	linked_queries = url_parsed.linked.map((linked) => {
		var linked_query = squel.select();

		linked_query = linked_query.from(context.resources[linked.resource].table);
		linked_query = linked.fields.reduce((query, field) => {
			return query.field(field);
		}, linked_query);
		linked_query = linked.filters.reduce((query, {field, values}) => {
			return query.where(field + ' IN (?)', values.join(','));
		}, linked_query);
		linked_query = linked.sorters.forEach((query, {field, asc}) => {
			return query.order(field, asc);
		}, linked_query);

		return linked_query;
	});

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

		response[url_parsed.primary.resource] = results[0].rows.length > 1 ? results[0].rows : results[0].rows[0];

		results.shift();
		if (results.length) {
			response.linked = {};
			results.forEach((result, i) => {
				response.linked[url_parsed.linked[i].resource] = results[i].rows.length > 1 ? results[i].rows : results[i].rows[0];
			});
		}

		return {response, status: 200}
	});
};
