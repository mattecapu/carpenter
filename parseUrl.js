/*!
	parseUrl
	parses an URL following the JSON API format specification
*/

var url_parser = require('url');

// full URL
module.exports = function(url) {

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
		ids: (path.length > 1 ? path[1].split(',') : 'any');
	};

	// client is actually asking for a resource linked to the root resource?
	if(path[2] === 'links') {
		// if yes, it must specify what linked resource it wants
		if (path.length === 3) throw new Error('invalid URL');
		// that becomes the primary resource of the request
		primary = {
			resource: path[3],
			ids: (path.length > 4 ? path[4].split(',') : 'any')
		};
		// and the root resource is just an additional filter
		primary.filters = [{field: 'id', values: root.resource.ids}];
	} else {
		// otherwise the root resource is also the primary resource
		primary = root;
	}

	// is the client asking for specific fields?
	if (typs(query.fields).notNull.check()) {
		primary.fields = query.fields.split(',');
		delete query.fields;
	} else {
		// if not, add all fields
		primary.fields = Object.keys(context.resources[primary.resource].type);
	}

	// is the client asking for a specific sorting?
	if (typs(query.sort).notNull().check()) {
		primary.sorters = query.sort.split(',').map((field) => {
			return field[0] === '-' ? {field: field.replace('-', ''), asc: false} : {field, asc: true};
		});
		delete query.sort;
	}

	// is the client asking for a filtered subset?
	primary.filters = primary.filters || [];
	Object.keys(context.resources[primary_resource].type).forEach((field) => {
		if (field === 'id') return;
		if (query[field] !== undefined) primary.filters.push({field, values: query[field]});
	});
	// anyway, we filter with the resource ID given (if given)
	if (primary.ids !== 'any') primary.filters.id = primary.ids;

	// is the client asking also for linked resources?
	if (typs(query.include).notNull().check()) {
		// get all the resources and their constraints (see primary)
		linked = query.include.split(',').map((linked_resource) => {
			var linked = {resource: linked_resource};

			linked.fields = [];
			var key = 'fields[' + linked_resource + ']';
			if (typs(query[key]).notNull().check()) {
				linked.fields = query[key].split(',');
				delete query[key];
			}

			linked.sorters = [];
			var key = 'sort[' + linked_resource + ']';
			if (typs(query[key]).notNull().check()) {
				linked.sorters = query[key].split(',').map((field) => {
					return field[0] === '-' ? {field: field.replace('-', ''), asc: false} : {field, asc: true};
				});
				delete query[key];
			}

			/*linked.filters = [];
			Object.keys(context.resources[linked_resource].type).forEach((field) => {
				if (field === 'id') return;
				if (query[field] !== undefined) linked.filters.push({field, value: query[field]});
			});*/

			return linked;
		});

		delete query.include;
	}

	return {primary, linked};
}