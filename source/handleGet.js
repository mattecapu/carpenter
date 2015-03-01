/*!
	GET requests handler
*/


var squel = require('squel');
var Promise = require('bluebird');
var typs = require('typs');

var {filterBy, selectBy} = require('./queryBuilder.js');


var handleGet = function (request, body, context) {
	squel.useFlavour('mysql');

	let primary_query = selectBy(request.primary, context);
	let linked_queries = request.linked.map((linked) => selectBy(linked, context));

	let promises = [].concat(primary_query, linked_queries).map((query) => context.callQuery(query));

	let normalize_response = (request, response) => {
		// walk the request searching for "possibility of collection"
		// if all the parent resources are necessarily single, then we return a single object
		// otherwise, if even just one parent resource can be a collection, return a collection
		let is_single = true;
		let parent_resource = request;
		do {
			// it can be a single resource only if:
			// 1. is related to the parent resource with a one-to-one relationship (i.e. /articles/2/author)
			// 2. it has been requested with a single ID (i.e. /articles/2)
			is_single = parent_resource.relationship && parent_resource.relationship.to === 'one'
						|| parent_resource.ids && (parent_resource.ids.length === 1 && parent_resource.ids[0] !== 'any');
			parent_resource = parent_resource.superset;
		} while (is_single && typs(parent_resource).def().check());

		if (is_single) {
			// single object, empty response
			if (typs(response[0]).undef().check()) {
				return null;
			}
			// single object, defined
			return response[0];
		} else {
			// collection, empty response
			if (typs(response).undef().check()) {
				return [];
			}
			// populated collection
			return response;
		}
	};

	return Promise.all(promises).map((res) => res[0]).then((results) => {

		let response = {};
		let status = results[0].length > 0 ? 200 : 404;

		// primary resource
		response[request.primary.type] = results[0];
		// add type member
		response[request.primary.type].forEach((result) => result.type = request.primary.type);
		// if a single object was requested, return it as an object and not as a collection
		response[request.primary.type] = normalize_response(request.primary, response[request.primary.type]);


		// are there any additional resources?
		if (request.linked.length) {
			// skip the first resource (primary)
			results.slice(1).forEach((result, i) => {
				response[request.linked[i].relationship.name] = result;
				// if it's a single resource, return it as an object
				response[request.linked[i].relationship.name] = normalize_response(request.linked[i], response[request.linked[i].relationship.name]);
			});
		}

		return {response, status};
	});
};

module.exports = handleGet;
