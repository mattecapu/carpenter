/*!
	Validate a resource request
*/

var typs = require('typs');

var assertResourceExists = require('./assertResourceExists.js');
var jsonError = require('./jsonError.js');

module.exports = function(resource_request, context) {
	assertResourceExists(resource_request.resource, context);

	if (typs(resource_request.ids).notNull().check()) {
		resource_request.ids.forEach((id) => {
			if (id === 'any') return;
			if (typs(id).isnt(context.resources[resource_request.resource].structure[context.resources[resource_request.resource].keys.primary].type)) {
				throw new jsonError({
					title: 'Bad request',
					detail: 'One or more ids specificed for the request are not \'' + resource_request.resource + '\' valid ids',
					status: 400
				});
			}
		});
	}

	var all_fields_exists = resource_request.fields.every((field) => {
		return -1 !== Object.keys(context.resources[resource_request.resource].structure).indexOf(field);
	});
	if (!all_fields_exists) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields requested don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}

	var all_filters_exists = resource_request.filters.every(function({field}) {
		return -1 !== Object.keys(context.resources[resource_request.resource].structure).indexOf(field);
	});
	if (!all_filters_exists) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested filters don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}

	var all_sorters_exists = resource_request.sorters.every(function({field, asc}) {
		return -1 !== Object.keys(context.resources[resource_request.resource].structure).indexOf(field);
	});
	if (!all_sorters_exists) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested sorters don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}
};
