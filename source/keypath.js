/*!
	Return the path made by the relationships' key
*/

export default function (rel) {
	let keys = [];
	while (rel && rel.relationship) {
		keys.unshift(rel.relationship.name)
		rel = rel.superset;
	}
	return keys.join('.');
}
