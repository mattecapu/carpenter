/*!
	parseRequest
	parses an URL following the JSON API format specification
*/

import url_parser from 'url';
import typs from 'typs';

import jsonError from './jsonError.js';
import assertResourceExistence from './assertResourceExistence.js';
import keypath from './keypath.js';
import parseParams from './parseRequest.parseParams.js';
import parseSchemaHierarchy from './parseRequest.parseSchemaHierarchy.js';

export default function (url, method, context) {

	// request representation
	let request = {main: {}, related: []};

	// parse the URL string
	let parsed = url_parser.parse(url, true);
	let path = parsed.pathname.split('/');
	let query = parsed.query;

	// trim path
	if ('' === path[0]) path.shift();
	if ('' === path[path.length - 1]) path.pop();

	if (0 === path.length) return null;

	// root resource (the first specified collection in the URL)
	let root = {
		type: path[0],
		ids: path.length > 1 ? path[1].split(',') : ['any']
	};

	// check existence of the resource collection
	assertResourceExistence(root.type, context);

	// main resource
	request.main = parseSchemaHierarchy(path.slice(2), root, context);

	// for this parameters, the name of the main resource can be omitted
	// if it's the only one in the response
	// let's normalize that behaviour
	if (query['fields[' + request.main.type +']'] === undefined) {
		query['fields[' + request.main.type +']'] = query.fields;
	}
	if (query['sort[' + request.main.type +']'] === undefined) {
		query['sort[' + request.main.type +']'] = query.sort;
	}
	delete query.sort;
	delete query.fields;

	// normalize filters (<field>=<value>) for the main resource
	Object.keys(context.resources[request.main.type].attributes).forEach((field) => {
		let key = (request.main.relationship ? keypath(request.main) : request.main.type) + '[' + field + ']';
		if (query[key] === undefined) {
			query[key] = query[key] || query[field];
		}
		delete query[field];
	});

	request.main = parseParams(request.main, query, context);

	// is the client asking also for related resources?
	if (method === 'GET' && query.include !== undefined) {
		// get all the resources and their constraints (see main)
		request.related =
			query.include.split(',').map(x => x.trim())
				// parse relationship path (i.e. comments.post.author)
				.map((rel) => rel.split('.').map((x) => [x, 'any']).reduce((f, o) => f.concat(o), []))
				// resolve request
				.map((rel) => parseSchemaHierarchy(rel, request.main, context))
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
				.map((rel) => parseParams(rel, query, context))
				// flag directly requested relationships
				.map((rel) => {
					rel.directly_requested = true;
					return rel;
				});
	}

	return request;
}
