/*!
	GET requests handler
*/
var eyes=require('eyes');

var squel = require('squel');
var Promise = require('bluebird');

var filterBy = require('./filterBy.js');


var buildQuery = function (resource_request, context) {
	var query = filterBy(squel.select(), resource_request, context);

	resource_request.fields.forEach((field) => {
		query = query.field(context.resources[resource_request.resource].structure[field].sql_column, field);
	});

	return query;
};

var handleGet = function (request, body, context) {
	squel.useFlavour('mysql');

	var primary_query = buildQuery(request.primary, context);
	var linked_queries = request.linked.map((linked) => buildQuery(linked, context));

	var promises = [].concat.apply([primary_query], [linked_queries]).map((query) => context.callQuery(query));

	var buildResponse = function (result) {
		return result.length > 1 ? result : result[0];
	}

	return Promise.all(promises).map((res) => res[0]).then((results) => {
		var response = {};

		if (0 === results[0].length) return {response, status: 404};

		var linked_index = {};
		var foreigns = context.resources[request.primary.resource].keys.foreigns.map((foreign) => foreign.field);
		foreigns.forEach((foreign) => {
			linked_index[foreign] = {};
		});
		foreigns.forEach((foreign) => {
			results[0].forEach((result) => {
				linked_index[foreign][result[foreign]] = linked_index[foreign][result[foreign]] || [];
				linked_index[foreign][result[foreign]].push(result);
			});
		});

		response[request.primary.resource] = buildResponse(results[0]);

		if (request.linked.length) {
			response.linked = {};
			results.slice(1).filter((r) => 0 !== r.length).forEach((result, i) => {
				//response.linked[request.linked[i].resource] = buildResponse(result);

				var primary_key = context.resources[request.linked[i].resource].keys.primary;
				var foreign_key = request.linked[i].superset.foreign.field;

				result.forEach((object) => {
					object.type = request.linked[i].resource;
					linked_index[foreign_key][object[primary_key]].forEach((primary) => {
						primary.links = primary.links || {};
						delete primary[foreign_key];
						primary.links[foreign_key] = object;
					});
				});
			});
		}

		return {response, status: 200};
	});
};

module.exports = handleGet;
