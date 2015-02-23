/*!
	GET requests handler
*/


var squel = require('squel');
var Promise = require('bluebird');

var {filterBy, selectBy} = require('./queryBuilder.js');


var handleGet = function (request, body, context) {
	squel.useFlavour('mysql');

	let primary_query = selectBy(request.primary, context);
	let linked_queries = request.linked.map((linked) => selectBy(linked, context));

	var promises = [].concat(primary_query, linked_queries).map((query) => context.callQuery(query));

	return Promise.all(promises).map((res) => res[0]).then((results) => {

		let response = {};

		// empty response
		if (0 === results[0].length) {
			return {response, status: 404};
		}

		// primary resource
		response.data = results[0];
		// add type member
		response.data.forEach((result) => result.type = request.primary.type);
		// if its a single object, unwrap it from the array
		if (response.data.length === 1) {
			response.data = response.data[0];
		}

		// are there any additional resources?
		if (request.linked.length) {
			response.linked = {};
			
			results.slice(1).forEach((result, i) => {
				response.linked[request.linked[i].type] = result;
			});
		}

		return {response, status: 200};
	});
};

module.exports = handleGet;
