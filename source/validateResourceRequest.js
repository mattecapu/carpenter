/*!
	Validate a resource request
*/


var typs = require('typs');

var assertResourceExists = require('./assertResourceExists.js');
var allFieldsExist = require('./allFieldsExist.js');
var jsonError = require('./jsonError.js');


var validateResourceRequest = function (resource_request, context) {
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

	if (!allFieldsExist(resource_request.fields, resource_request.resource, context)) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields requested don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}

	var filters_fields = resource_request.filters.map((f) => f.field);
	if (!allFieldsExist(filters_fields, resource_request.resource, context)) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested filters don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}

	var sorters_fields = resource_request.sorters.map((f) => f.field);
	if (!allFieldsExist(sorters_fields, resource_request.resource, context)) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested sorters don\'t belong to \'' + resource_request.resource + '\' resource',
			status: 400
		});
	}
};

module.exports = validateResourceRequest;
