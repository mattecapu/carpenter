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
		resource_obj.fields = Object.keys(context.resources[resource_obj.type].attributes);
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

	if (resource_obj.ids && resource_obj.ids[0] !== 'any') {
		resource_obj.filters.push({
			field: 'id',
			values: resource_obj.ids
		});
	}

	return resource_obj;
};

var parseUrl = function (url, context) {
	// parse the URL string
	var parsed = url_parser.parse(url, true);
	var path = parsed.pathname;
	var query = parsed.query;

	// split the path and trim empty parts
	path = path.split('/');
	if ('' === path[0]) path.shift();
	if ('' === path[path.length - 1]) path.pop();

	if (0 === path.length) return null;

	// primary resource
	var primary = {};
	// linked resources
	var linked = [];

	let path_index = 0;

	// root resource (the first specified collection in the URL)
	var root = {
		type: path[path_index],
		ids: path.length > path_index + 1 ? path[path_index + 1].split(',') : ['any']
	};

	// check existence of the resource collection
	assertResourceExists(root.type, context);

	primary = root;

	// is a path to a linked resource?
	while('links' === path[path_index + 2]) {
		// if yes, it must specify what linked resource it wants
		if (typs(path[path_index + 3]).undef().check()) {
			throw new jsonError({
				title: 'Bad request',
				detail: 'Linked resource not specified',
				status: 400
			});
		}

		// recover the relationship data from the resource description
		let relationship = Object.keys(context.resources[primary.type].relationships).filter((r) => r === path[path_index + 3])[0];
		if (typs(relationship).undef().check()) {
			throw new jsonError({
				title: 'Bad request',
				detail: 'The specified linked resource is not actually linked to \'' + primary.type + '\'',
				status: 404
			});
		}
		relationship = context.resources[primary.type].relationships[relationship];

		// that becomes the primary resource of the request
		primary = {
			type: relationship.type,
			superset: {
				request: parse(primary, {}, context),
				relationship: relationship
			}
		};

		// let's proceed with the next tokens
		path_index += 2;
	}
	if (typs(path[path_index + 2]).def().check()) {
		throw new jsonError({
			title: 'Bad request',
			detail: 'The URL is malformed',
			status: 404
		});
	}

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
		if ('include' === field || 'fields' === field) return;
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
		linked = query.include.split(',').map((link) => {
			// we fetch the relationship required, if it doesn't exist, we fire an error
			// (resource existence is already checked at declaration-time as part of relationships validation)
			let relationship = Object.keys(context.resources[primary.type].relationships).filter((r) => r === link)[0];
			if (typs(relationship).undef().check()) {
				throw new jsonError({
					title: 'Bad request',
					detail: '\'' + link + '\' is not a relationship of \'' + root.type + '\'',
					status: 404
				});
			}
			// store the actual relationship description
			relationship = context.resources[primary.type].relationships[relationship];

			return {
				type: relationship.type,
				superset: {
					request: primary,
					relationship: relationship
				}
			};
		}).map((resource) => {
			return parse(resource, query, context);
		});
	}

	return {primary, linked};
};

module.exports = parseUrl;
