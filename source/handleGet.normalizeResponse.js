import typs from 'typs';

export default function (request, response) {
	// walk the request searching for "possibility of collection"
	// if all the parent resources are necessarily single, then we return a single object
	// otherwise, if even just one parent resource can be a collection, return a collection
	let is_single = true;
	let parent_resource = request;
	do {
		// it *can* be a single resource only if:
		// 1. is related to the parent resource with a one-to-one relationship (i.e. /articles/2/author)
		// 2. it has been requested with a single ID (i.e. /articles/2)
		is_single = parent_resource.relationship && parent_resource.relationship.to === 'one'
					|| parent_resource.ids && (parent_resource.ids.length === 1 && parent_resource.ids[0] !== 'any');
		parent_resource = parent_resource.superset;
	} while (is_single && typs(parent_resource).def().check());

	if (is_single) {
		// single object, empty response
		if (typs(response[request.type][0]).undef().check()) {
			return null;
		}
		// single object, defined
		response[request.type] = response[request.type][0];
	} else {
		// collection, empty response
		if (typs(response).undef().check()) {
			return [];
		}
		// else we return the already populated collection
	}
	return response;
}
