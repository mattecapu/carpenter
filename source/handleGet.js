/*!
	GET requests handler
*/

var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./jsonError.js');
var filterBy = require('./filterBy.js');

module.exports = function (request, body, context) {
	squel.useFlavour('mysql');

	var primary_query = filterBy(squel.select(), request.primary, context);
	var linked_queries = request.linked.map((linked) => filterBy(squel.select(), linked, context));

	var promises = [].concat.apply([primary_query], [linked_queries]).map((query) => context.callQuery(query));

	var buildResponse = function(result) {
		return result.length > 1 ? result : result[0];
	}

	return Promise.all(promises).then((results) => {
		var response = {};

		if (0 === results[0].length) return {response, status: 404}
		response[request.primary.resource] = buildResponse(results[0]);

		if (request.linked.length) {
			response.linked = {};
			results.slice(1).filter((r) => 0 !== r.length).forEach((result, i) => {
				response.linked[request.linked[i].resource] = buildResponse(result);
			});
		}

		return {response, status: 200};
	});
};
