/*!
	Parse a path into its components
*/

import parseParams from './parseRequest.parseParams.js';

export default function (path, root, context) {
	// takes track of the point we have parsed the path until now
	let path_segment = 0;
	// the parent resource wrt we parse the path
	let parent_resource = root;

	// is a path to a related resource?
	while(path[path_segment] !== undefined) {

		// recover the relationship data from the resource description
		const relationship = context.resources[parent_resource.type].relationships.filter((r) => r.name === path[path_segment])[0];

		if (relationship === undefined) {
			throw new jsonError({
				title: 'Bad request',
				details: '\'' + path[path_segment] + '\' is not a relationship of \'' + parent_resource.type + '\'',
				status: 404
			});
		}

		// that becomes the main resource of the request
		parent_resource = {
			relationship: relationship,
			type: relationship.type,
			superset: parseParams(parent_resource, {}, context)
		};

		if (relationship.to === 'many') {
			parent_resource.ids = path.length > path_segment + 1 ? path[path_segment + 1].split(',') : ['any'];
			// skip ids
			++path_segment;
		} else if (path[path_segment + 1] === 'any') {
			++path_segment;
		}

		// let's proceed with the next tokens
		++path_segment;
	}
	return parent_resource;
}
