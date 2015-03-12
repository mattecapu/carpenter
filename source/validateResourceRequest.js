/*!
	Validate a resource request
*/


var typs = require('typs');

var assertResourceExists = require('./assertResourceExists.js');
var domains = require('./domains.js');
var jsonError = require('./jsonError.js');


var allFieldsExist = function (fields, resource_type, context) {
	return typs(fields).andEach().oneOf(
		Object.keys(context.resources[resource_type].columns)
	).check();
};

var validateResourceRequest = function (request, context) {
	
	// validate related resources
	if (typs(request.related).def().check()) {
		request.related.forEach((rel) => validateResourceRequest(rel, context));
	}

	// the main resource is wrapped in another object
	if (typs(request.main).def().check()) {
		request = request.main;
	}
	
	assertResourceExists(request.type, context);

	if (typs(request.ids).notNull().check()) {
		request.ids.forEach((id) => {
			if (id === 'any') return;
			if (typs(id).isnt(domains.id)) {
				throw new jsonError({
					title: 'Bad request',
					detail: 'One or more ids specificed for the request are not valid ids',
					status: 400
				});
			}
		});
	}

	if (!allFieldsExist(request.fields, request.type, context)) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields requested don\'t belong to \'' + request.type + '\' resource',
			status: 400
		});
	}

	var filters_fields = request.filters.map((f) => f.field);
	if (!allFieldsExist(filters_fields, request.type, context)) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested filters don\'t belong to \'' + request.type + '\' resource',
			status: 400
		});
	}

	var sorters_fields = request.sorters.map((f) => f.field);
	if (!allFieldsExist(sorters_fields, request.type, context)) {
		throw new jsonError({
			title: 'Unknown fields',
			detail: 'One or more fields in the requested sorters don\'t belong to \'' + request.type + '\' resource',
			status: 400
		});
	}
	
	// validate parent resource
	if (typs(request.superset).def().check()) {
		validateResourceRequest(request.superset, context);
	}
};

module.exports = validateResourceRequest;
