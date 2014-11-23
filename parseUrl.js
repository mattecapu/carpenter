/*!
	parseUrl
	parses an URL following the JSON API format specification
*/

var typs = require('typs');

var jsonError = require('./error.js');
var assertResourceExists = require('./assertResourceExists.js');

var parse = function(resource_obj, query, context) {
	// is the client asking for a particular subset of fields?
	resource_obj.fields = resource_obj.fields || [];
	var key = 'fields[' + resource_obj.resource + ']';
	if (typs(query[key]).notNull().check()) {
		resource_obj.fields = query[key].split(',');
	} else {
		// if not, add all fields
		resource_obj.fields = Object.keys(context.resources[resource_obj.resource].type);
	}

	// is the client asking for a particular sorting?
	resource_obj.sorters = resource_obj.sorters || [];
	var key = 'sort[' + resource_obj.resource + ']';
	if (typs(query[key]).notNull().check()) {
		resource_obj.sorters = query[key].split(',').map((field) => {
			return field[0] === '-' ? {field: field.replace('-', ''), asc: false} : {field, asc: true};
		});
	}

	// is the client asking for a filtered response?
	resource_obj.filters = resource_obj.filters || [];
	Object.keys(context.resources[resource_obj.resource].type).forEach((field) => {
		if (field === context.resources[resource_obj.resource].keys.primary) return;
		var key = resource_obj.resource + '[' + field + ']';
		if (!typs(query[key]).notNull().check()) resource_obj.filters.push({field, value: query[key]});
	});

	return resource_obj;
};

// 'url' is a *full* URL
module.exports = function(url, context) {

	var {path, query} = require('url').parse(url, true);

	// split the url and trim empty parts
	if (path[0] === '') path.shift();
	if (path[path.length - 1] === '') path.pop();

	// primary resource
	var primary = {};
	// linked resources
	var linked = [];

	// root resource (the first specified collection in the URL)
	var root = {
		resource: path[0],
		ids: (path.length > 1 ? path[1].split(',') : 'any')
	};
	assertResourceExists(root.resource, context);

	// client is actually asking for a resource linked to the root resource?
	if (path[2] === 'links') {
		// if yes, it must specify what linked resource it wants
		if (path.length === 3) {
			throw new jsonError({
				title: 'Bad request',
				detail: 'Linked resource not specified',
				status: 400
			});
		}

		// check what resource type the foreign reference specified is
		// (length === 1 guaranteed by resource description validation)
		var foreign = context.resources[root.resource].keys.foreign.filter((foreign) => {
			if (foreign.filter === path[3]) return true;
			return false;
		})[0];
		if (!typs(foreign).notNull().check()) {
			throw new jsonError({
				title: 'Bad request',
				detail: 'The specified linked resource is not actually linked to \'' + root.resource + '\'',
				status: 400
			});
		}

		// that becomes the primary resource of the request
		primary = {
			resource: foreign.resource,
			ids: (path.length > 4 ? path[4].split(',') : 'any')
		};
		assertResourceExists(primary.resource, context);
		// and the root resource is just an additional filter
		primary.subset_from = root;
		primary.subset_from.referenced_field = foreign.filter;
	} else {
		// otherwise the root resource is also the primary resource
		primary = root;
	}

	query['fields[' + primary.resource +']'] = query.fields;
	query['sort[' + primary.resource +']'] = query.sort;
	delete query.sort;
	delete query.fields;

	primary = parse(primary, query, context);
	// anyway, we filter with the resource ID given (if given)
	if (primary.ids !== 'any') primary.filters.push({field: context.resource[primary.resource].keys.primary, values: primary.ids});

	// is the client asking also for linked resources?
	if (typs(query.include).notNull().check()) {
		// get all the resources and their constraints (see primary)
		linked = query.include.split(',').map((resource) => {
			assertResourceExists(resource, context);
			var exist_reference = context.resource[primary.resource].keys.foreign.some((foreign) => {
				return foreign.resource === resource;
			});
			if (!exist_reference) {
				throw new jsonError({
					title: 'Bad request',
					detail: 'The specified linked resource is not actually linked to \'' + root.resource + '\'',
					status: 400
				});
			}
			return parse({resource}, query, context);
		});
	}

	return {primary, linked};
};
