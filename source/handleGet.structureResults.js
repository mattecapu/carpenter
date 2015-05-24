/*!
	Structures results from SELECT queries
	eliminating JOIN's artifact
*/

export default function (results, request, context) {
	// generates a unique 'key' to identify a requested
	// related resource (i.e. album.contributors)
	const keypath = (rel) => {
		let keys = [];
		while (rel) {
			keys.unshift(rel.relationship.name)
			rel = rel.superset;
		}
		return keys.join('.');
	};

	// return the innermost relationship of the tree (aka the root)
	const root_rel = (rel) => {
		while (rel.superset) {
			rel = rel.superset;
		}
		return rel;
	};

	const cloneInfo = (obj) => {
		let clone = {
			type: obj.type,
			relationship: {
				name: obj.relationship.name,
				type: obj.relationship.type,
				to: obj.relationship.to
			}
		};
		if (obj.superset !== undefined) {
			clone.superset = cloneInfo(obj.superset);
		}
		return clone;
	};

	const buildTree = (related) => {
		// roots are all the bottom resources in the superset chain
		let roots = related.map((rel) => root_rel(rel));
		const keypaths = roots.map(x => keypath(x));
		roots = roots.filter((_, i) => i === keypaths.indexOf(keypaths[i]));

		// build the rest of the tree
		return roots.map((root) => {
			const children =
				related
					// same ancestor
					.filter((rel) => keypath(root) === keypath(root_rel(rel)))
					// deepen one more level
					.reduce((children_rels, parent_rel) => {
						if (parent_rel.superset === undefined) return children_rels;
						let cursor = parent_rel;
						while (cursor.superset.superset) {
							cursor = cursor.superset;
						}
						delete cursor.superset;
						return children_rels.concat(parent_rel);
					}, []);
			root.children = buildTree(children);
			return root;
		});
	};


	const structureArray = (unmerged, parent_type, tree) => {
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
			const is_first_occurence = merged.every((already_merged) => {
				// if we found an occurence of this resource
				// before, merge it to the previous resource
				if (already_merged[pk] === to_merge[pk] && to_merge[pk] !== null) {
					merge(already_merged, to_merge);
					return false;
				}
				return true;
			});
			// if it's the first time we encounter
			// the resource, we push it to the collection,
			// otherwise we merged it before so we just
			// return the collection as-is
			if (!is_first_occurence) return merged;
			return merged.concat(to_merge);
		}, []);

		// we make sure one-to-many relationships are arrays
		// even if they contain only one resource
		// (in which case they would still not be array at this point)
		tree.forEach((rel) => {
			merged.forEach((res) => {
				const key = rel.relationship.name;
				if (rel.relationship.to === 'many') {
					res[key] = arrayfy(res[key]);
					if (res[key][0][context.resources[rel.relationship.type].primary_key] === null) {
						res[key] = [];
					}
				}
			});
		});

		// recursive step: merge subresources
		tree.forEach((rel) => {
			merged.forEach((res) => {
				const key = rel.relationship.name;
				// merges subresources
				res[key] = structureArray(
					arrayfy(res[key]),
					rel.type,
					rel.children
				);
				// we unwrap one-to-one relationships from the
				// array container which structureArray() puts
				if (rel.relationship.to === 'one') {
					res[key] = res[key][0];
					if (res[key][context.resources[rel.relationship.type].primary_key] === null) {
						res[key] = null;
					}
				}
			})
		});

		return merged;
	};

	return structureArray(
		results.map(x => x[request.main.type]),
		request.main.type,
		buildTree(
			request.related.map(x => cloneInfo(x))
		)
	);
}
