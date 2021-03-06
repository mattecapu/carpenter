/*!
	parseRequest
	parses an URL following the JSON API format specification
*/

import url_parser from 'url';
import typs from 'typs';

import assertResourceExistence from './assertResourceExistence.js';
import parseParams from './parseRequest.parseParams.js';
import parseSchemaHierarchy from './parseRequest.parseSchemaHierarchy.js';

export default function (url, method, context) {

	// request representation
	let request = {main: {}, related: []};

	// parse the URL string
	const parsed = url_parser.parse(url, true);
	let path = parsed.pathname.split('/');
	let querystring = parsed.query;

	// trim path
	if (path[0] === '') path.shift();
	if (path[path.length - 1] === '') path.pop();

	if (path.length === 0) return null;

	// root resource (the first specified collection in the URL)
	const root = {
		type: path[0]
	};

	// first let's check existence of the root resource collection
	assertResourceExistence(root.type, context);

	// check if the next path segment is a relationship or an ID filter
	if (Object.keys(context.resources[root.type].relationships).indexOf(path[1]) !== -1) {
		root.ids = [];
	} else {
		root.ids = path[1] ? path[1].split(',') : [];
		path = path.slice(1);
	}
	path = path.slice(1);

	// main resource
	request.main = parseSchemaHierarchy(path, querystring, root, context);

	// for this parameters, the name of the main resource can be omitted
	// if it's the only one in the response: let's normalize that behaviour
	const res_key = request.main.relationship ? request.main.relationship.name : request.main.type;
	if (querystring['fields[' + res_key +']'] === undefined && querystring.fields !== undefined) {
		querystring['fields[' + res_key +']'] = querystring.fields;
	}
	if (querystring['sort[' + res_key +']'] === undefined && querystring.sort !== undefined) {
		querystring['sort[' + res_key +']'] = querystring.sort;
	}
	delete querystring.sort;
	delete querystring.fields;

	// normalize filters (<field>=<value>) for the main resource
	let res_attributes = Object.keys(context.resources[request.main.type].attributes);
	if (request.main.relationship !== undefined) {
		res_attributes = Object.keys(request.main.relationship.attributes).concat(res_attributes);
	}
	res_attributes.forEach((field) => {
		const key = res_key + '[' + field + ']';
		if (querystring[key] === undefined && querystring[field] !== undefined) {
			querystring[key] = querystring[field];
		}
		delete querystring[field];
	});

	request.main = parseParams(request.main, querystring, context);

	// is the client asking also for related resources?
	if (method === 'GET' && querystring.include !== undefined) {
		// get all the resources and their constraints (see main)
		request.related =
			querystring.include.split(',')
				// parse relationship path (i.e. comments.post.author)
				.map((rel) => rel.split('.'))
				// resolve request
				.map((rel) => parseSchemaHierarchy(rel, {}, request.main, context))
				// remove last filter for related resource because they're already filtered at top level
				// (it messes up with query building)
				.map((rel) => {
					let parent = rel;
					// dig down until we found the root request
					while (typs(parent.superset).notEquals(request.main).check()) {
						parent = parent.superset;
					}
					delete parent.superset;
					return rel;
				})
				// parse the rest of parameters
				.map((rel) => parseParams(rel, querystring, context))
				// flag directly requested relationships
				.map((rel) => {
					rel.directly_requested = true;
					return rel;
				});
	}

	return request;
}
