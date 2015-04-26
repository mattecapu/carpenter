/*!
	Merges results from SELECT queries
	eliminating JOIN's artifact
*/

import keypath from './keypath.js';

// return the innermost relationship of the tree (aka the root)
const root_rel = (rel) => {
	while (rel.superset) {
		rel = rel.superset;
	}
	return rel;
};
const build_tree = (rels) => {
	// roots are all the bottom resources in the superset chain
	const roots = rels.map((rel) => root_rel(rel))
					// remove dupes
					.filter((rel, i, all) => {
						return i === all.map(x => keypath(x)).indexOf(keypath(rel))
					});
	// build the rest of the tree
	roots.forEach((root) => {
		root.children = build_tree(
				// same ancestor
			rels.filter((rel) => keypath(root) === keypath(root_rel(rel)))
				// deepen one more level
				.reduce((new_rels, sub_rel) => {
					if (sub_rel.superset === undefined) return new_rels;
					let sup = sub_rel;
					while (sup.superset.superset) {
						sup = sup.superset;
					}
					delete sup.superset;
					return new_rels.concat(sub_rel);
				}, [])
		);
	});
	return roots;
};

const mergeArray = (unmerged, parent_type, tree, context) => {

	// utility equivalent to is_array(x) ? x : [x]
	const arrayfy = (x) => [].concat(x);

	const merge = (already_merged, to_merge) => {
		tree.forEach((rel) => {
			const key = rel.relationship.name;
			already_merged[key] =
				arrayfy(already_merged[key]).concat(to_merge[key]);
		});
	};

	const pk = context.resources[parent_type].primary_key;
	let merged = [];

	merged = unmerged.reduce((merged, to_merge) => {
		const first_occurence = merged.every((already_merged) => {
			// if we found an occurence of this resource
			// before, merge it to the previous resource
			if (already_merged[pk] === to_merge[pk]) {
				merge(already_merged, to_merge);
				return false;
			}
			return true;
		});
		// if it's the first time we encounter
		// the resource, we push it to the collection,
		// otherwise we merged it before so we just
		// return the collection as-is
		if (!first_occurence) return merged;
		return merged.concat(to_merge);
	}, []);

	// we make sure one-to-many relationships are arrays
	// even if they contain only one resource
	// (in which case they would still not be array at this point)
	tree.forEach((rel) => {
		merged.forEach((res) => {
			const key = rel.relationship.name;
			if (rel.relationship.to === 'many') res[key] = arrayfy(res[key]);
		});
	});

	// recursive step: merge subresources
	tree.forEach((rel) => {
		merged.forEach((res) => {
			let key = rel.relationship.name;
			// merges subresources
			res[key] = mergeArray(
				arrayfy(res[key]),
				rel.type,
				rel.children,
				context
			);
			// we unwrap one-to-one relationships from the
			// array container which mergeArray() puts
			if (rel.relationship.to === 'one') res[key] = res[key][0];
		})
	});

	return merged;
};

export default function (results, request, context) {
	return mergeArray(
		results.map(x => x[request.main.type]),
		request.main.type,
		build_tree(request.related),
		context
	)
}
