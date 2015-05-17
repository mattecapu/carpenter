/*!
	Parse a path into its components
*/

import parseParams from './parseRequest.parseParams.js';
import jsonError from './jsonError.js';

export default function (path, querystring, root, context) {

	// takes track of the point we have parsed the path until now
	let path_segment = 0;

	// the parent resource with respect to whom we parse the path
	// initialized to the root resource (the first specified collection in the URL)
	let parent_resource = root;

	// is it a path to a related resource?
	while(path[path_segment] !== undefined) {

		// recover the relationship data from the resource description
		const relationship = context.resources[parent_resource.type].relationships[path[path_segment]];

		if (relationship === undefined) {
			throw new jsonError({
				title: 'Bad request',
				details: '\'' + path[path_segment] + '\' is not a relationship of \'' + parent_resource.type + '\'',
				status: 404
			});
		}

		// that becomes the main resource of the request
		parent_resource = {
			relationship,
			type: relationship.type,
			superset: parseParams(parent_resource, querystring, context)
		};

		// if the next path segment is a relationship, don't filter by ID
		if (Object.keys(context.resources[parent_resource.type].relationships).indexOf(path[path_segment + 1]) !== -1) {
			parent_resource.ids = [];
		} else {
			// otherwise parse the ids
			parent_resource.ids = path[path_segment + 1] ? path[path_segment + 1].split(',') : [];
			++path_segment;
		}

		// let's proceed with the next tokens
		++path_segment;
	}
	return parent_resource;
}
