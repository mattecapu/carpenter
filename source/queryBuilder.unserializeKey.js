/*!
	Convert a key in the form <key1>$<key2>$<key3>:<value>
	to its object representation {<key1>: {<key2>: {<key3>: <value>}}}
*/

export default function (source, dest, long_key) {
	long_key.split('$').reduce((obj, key, i, a) => {
		return obj[key] || (obj[key] = (i === a.length - 1 ? source[long_key] : {}));
	}, dest);
}
