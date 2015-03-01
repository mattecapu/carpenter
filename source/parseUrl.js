/*!
	parseUrl
	parses an URL following the JSON API format specification
*/


var url_parser = require('url');
var typs = require('typs');

var jsonError = require('./jsonError.js');
var assertResourceExists = require('./assertResourceExists.js');


var parse = function (resource_obj, query, context) {

	let key = '';

	// is the client asking for a particular subset of fields?
	resource_obj.fields = resource_obj.fields || [];
	key = 'fields[' + resource_obj.type + ']';
	if (typs(query[key]).def().check()) {
		resource_obj.fields = query[key].split(',');
	} else if (0 === resource_obj.fields.length) {
		// if not, add all fields
		resource_obj.fields = Object.keys(context.resources[resource_obj.type].columns); //Object.keys(context.resources[resource_obj.type].attributes);
	}
	
	// is the client asking for a particular sorting?
	resource_obj.sorters = resource_obj.sorters || [];
	key = 'sort[' + resource_obj.type + ']';
	if (typs(query[key]).def().check()) {
		resource_obj.sorters = query[key].split(',').map((field) => {
			return {
				field: field.slice(1),
				// fields are prefixed with + for ascending order and - for descending
				asc: field[0] === '+'
			};
		});
	}

	// is the client asking for a filtered response?
	resource_obj.filters = resource_obj.filters || [];
	Object.keys(context.resources[resource_obj.type].attributes).forEach((field) => {
		key = resource_obj.type + '[' + field + ']';
		if (typs(query[key]).def().check()) {
			resource_obj.filters.push({field, values: query[key].split(',')});
		}
	});

	return resource_obj;
};

var unnest = function (path, root, context) {
	
	let path_index = 0;
	let parent_resource = root;
	
	// is a path to a linked resource?
	while(typs(path[path_index]).def().check()) {

		// recover the relationship data from the resource description
		let relationship = context.resources[parent_resource.type].relationships.filter((r) => r.name === path[path_index])[0];

		if (typs(relationship).undef().check()) {
			throw new jsonError({
				title: 'Bad request',
				detail: '\'' + path[path_index] + '\' is not a relationship of \'' + parent_resource.type + '\'',
				status: 404
			});
		}

		// that becomes the primary resource of the request
		parent_resource = {
			relationship: relationship,
			type: relationship.type,
			superset: parse(parent_resource, {}, context)
		};
		
		if (relationship.to === 'many') {
			parent_resource.ids = path.length > path_index + 1 ? path[path_index + 1].split(',') : ['any'];
			// skip ids
			++path_index;
		} else if (path[path_index + 1] === 'any') {
			++path_index;
		}

		// let's proceed with the next tokens
		++path_index;
	}
	return parent_resource;
}

var parseUrl = function (url, context) {
	// parse the URL string
	var parsed = url_parser.parse(url, true);
	var path = parsed.pathname.split('/');
	var query = parsed.query;

	// trim path
	if ('' === path[0]) path.shift();
	if ('' === path[path.length - 1]) path.pop();

	if (0 === path.length) return null;

	// primary resource
	var primary = {};
	// linked resources
	var linked = [];

	// root resource (the first specified collection in the URL)
	var root = {
		type: path[0],
		ids: path.length > 1 ? path[1].split(',') : ['any']
	};

	// check existence of the resource collection
	assertResourceExists(root.type, context);

	primary = unnest(path.slice(2), root, context);

	// for this parameters, the name of the primary resource can be omitted
	// if it's the only one in the response
	// let's normalize that behaviour
	if (typs(query['fields[' + primary.type +']']).undef().check()) {
		query['fields[' + primary.type +']'] = query.fields;
	}
	if (typs(query['sort[' + primary.type +']']).undef().check()) {
		query['sort[' + primary.type +']'] = query.sort;
	}
	delete query.sort;
	delete query.fields;

	// normalize filters (<field>=<value>) for the primary resource
	Object.keys(context.resources[primary.type].attributes).forEach((field) => {
		let key = primary.type + '[' + field + ']';
		if (typs(query[key]).undef().check()) {
			query[key] = query[field];
		}
		delete query[field];
	});

	primary = parse(primary, query, context);

	// is the client asking also for linked resources?
	if (typs(query.include).def().check()) {
		// get all the resources and their constraints (see primary)
		linked = query.include.split(',')
					// parse relationship path (i.e. comments.post.author)
					.map((relationship) => relationship.split('.').map((x) => [x, 'any']).reduce((f, o) => f.concat(o), []))
					// resolve request
					.map((relationship) => unnest(relationship, primary, context))
					// parse the rest of parameters
					.map((resource) => parse(resource, query, context));
	}

	return {primary, linked};
};

module.exports = parseUrl;
