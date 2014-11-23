/*!
	Validate a resource request
*/

var typs = require('typs');

module.exports = function(resource_request, context) {
	if (!typs(context.resources[resource_request.resource]).notNull().check()) {
		throw new jsonError({
			title: 'Resource not found',
			detail: '\'' + resource_request.resource + '\' doesn\'t exist',
			status: 404
		});
	}

	var all_fields_exists = resource_request.resource.fields.every((field) => {
		return -1 !== Object.keys(context.resources[resource_request.resource].type).indexOf(field);
	});
	if(!all_fields_exists) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields requested don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}

	var all_filters_exists = resource_request.resource.filters.every(function({field, values}) {
		return -1 !== Object.keys(context.resources[resource_request.resource].type).indexOf(field);
	});
	if(!all_filters_exists) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested filters don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}

	var all_sorters_exists = resource_request.resource.sorters.every(function({field, asc}) {
		return -1 !== Object.keys(context.resources[resource_request.resource].type).indexOf(field);
	});
	if(!all_sorters_exists) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested sorters don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}
};
