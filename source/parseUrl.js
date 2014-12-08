/*!
	parseUrl
	parses an URL following the JSON API format specification
*/


var url_parser = require('url');
var typs = require('typs');

var jsonError = require('./jsonError.js');
var assertResourceExists = require('./assertResourceExists.js');


var parse = function (resource_obj, query, context) {
	// is the client asking for a particular subset of fields?
	resource_obj.fields = resource_obj.fields || [];
	var key = 'fields[' + resource_obj.resource + ']';
	if (typs(query[key]).notNull().check()) {
		resource_obj.fields = query[key].split(',');
	} else if (0 === resource_obj.fields.length) {
		// if not, add all fields
		resource_obj.fields = Object.keys(context.resources[resource_obj.resource].structure);
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
	Object.keys(context.resources[resource_obj.resource].structure).forEach((field) => {
		var key = resource_obj.resource + '[' + field + ']';
		if (typs(query[key]).notNull().check()) resource_obj.filters.push({field, values: query[key].split(',')});
	});

	if (resource_obj.ids && resource_obj.ids[0] !== 'any') {
		resource_obj.filters.push({
			field: context.resources[resource_obj.resource].keys.primary,
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

	var path_index = 0;

	// root resource (the first specified collection in the URL)
	var root = {
		resource: path[path_index + 0],
		ids: path.length > path_index + 1 ? path[path_index + 1].split(',') : ['any']
	};
	// check existence of the resource collection
	assertResourceExists(root.resource, context);

	primary = root;

	// is a path to a linked resource?
	while('links' === path[path_index + 2]) {
		// if yes, it must specify what linked resource it wants
		if (typs(path[path_index + 3]).Null().check()) {
			throw new jsonError({
				title: 'Bad request',
				detail: 'Linked resource not specified',
				status: 400
			});
		}

		// check what resource type the foreign reference specified is
		// (length === 1 guaranteed by resource description validation)
		var foreign = context.resources[primary.resource].keys.foreigns.filter((f) => f.field === path[path_index + 3])[0];
		if (typs(foreign).Null().check()) {
			throw new jsonError({
				title: 'Bad request',
				detail: 'The specified linked resource is not actually linked to \'' + primary.resource + '\'',
				status: 404
			});
		}

		// that becomes the primary resource of the request
		primary = {
			resource: foreign.resource,
			superset: {
				request: parse(primary, {}, context),
				foreign: foreign
			}
		};

		// let's proceed with the next tokens
		path_index += 2;
	}
	if (typs(path[path_index + 2]).notNull().check()) {
		throw new jsonError({
			title: 'Bad request',
			detail: 'The URL is malformed',
			status: 404
		});
	}

	// for this parameteres, the name of the primary resource can be omitted if it's the only one in the response
	if (typs(query['fields[' + primary.resource +']']).Null().check()) query['fields[' + primary.resource +']'] = query.fields;
	if (typs(query['sort[' + primary.resource +']']).Null().check()) query['sort[' + primary.resource +']'] = query.sort;
	delete query.sort;
	delete query.fields;
	Object.keys(context.resources[primary.resource].structure).forEach((field) => {
		if ('include' === field || 'fields' === field) return;
		var key = primary.resource + '[' + field + ']';
		if (typs(query[key]).Null().check()) query[key] = query[field];
		delete query[field];
	});

	primary = parse(primary, query, context);

	// is the client asking also for linked resources?
	if (typs(query.include).notNull().check()) {
		// get all the resources and their constraints (see primary)
		linked = query.include.split(',').map((foreign) => {
			// we fetch the foreign the request is referring to, if it doesn't exist, we fire an error
			// (resource existence is already checked at declaration-time as part of foreign-keys validation)
			foreign = context.resources[primary.resource].keys.foreigns.filter((f) => f.field === foreign)[0];
			if (typs(foreign).Null().check()) {
				throw new jsonError({
					title: 'Bad request',
					detail: '\'' + foreign + '\' is not a link of \'' + root.resource + '\'',
					status: 404
				});
			}

			return {
				resource: foreign.resource,
				superset: {request: primary, foreign}
			};
		}).map((resource) => {
			return parse(resource, query, context);
		});
	}

	return {primary, linked};
};

module.exports = parseUrl;
