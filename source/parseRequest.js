/*!
	parseRequest
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

	// is a path to a related resource?
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

		// that becomes the main resource of the request
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

var parseRequest = function (url, method, context) {
	
	// request representation
	let request = {};
	
	// parse the URL string
	let parsed = url_parser.parse(url, true);
	let path = parsed.pathname.split('/');
	let query = parsed.query;

	// trim path
	if ('' === path[0]) path.shift();
	if ('' === path[path.length - 1]) path.pop();

	if (0 === path.length) return null;

	// root resource (the first specified collection in the URL)
	var root = {
		type: path[0],
		ids: path.length > 1 ? path[1].split(',') : ['any']
	};

	// check existence of the resource collection
	assertResourceExists(root.type, context);

	// main resource
	request = unnest(path.slice(2), root, context);

	// for this parameters, the name of the main resource can be omitted
	// if it's the only one in the response
	// let's normalize that behaviour
	if (typs(query['fields[' + request.type +']']).undef().check()) {
		query['fields[' + request.type +']'] = query.fields;
	}
	if (typs(query['sort[' + request.type +']']).undef().check()) {
		query['sort[' + request.type +']'] = query.sort;
	}
	delete query.sort;
	delete query.fields;

	// normalize filters (<field>=<value>) for the main resource
	Object.keys(context.resources[request.type].attributes).forEach((field) => {
		let key = request.type + '[' + field + ']';
		if (typs(query[key]).undef().check()) {
			query[key] = query[field];
		}
		delete query[field];
	});

	request = parse(request, query, context);

	// is the client asking also for related resources?
	if (method === 'GET' && typs(query.include).def().check()) {
		// get all the resources and their constraints (see main)
		request.related =
			query.include.split(',')
				// parse relationship path (i.e. comments.post.author)
				.map((rel) => rel.split('.').map((x) => [x, 'any']).reduce((f, o) => f.concat(o), []))
				// resolve request
				.map((rel) => unnest(rel, request, context))
				// parse the rest of parameters
				.map((resource) => parse(resource, query, context));
	}
require('eyes').inspect(request);
	return request;
};

module.exports = parseRequest;
