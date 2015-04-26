export default function (source, dest, long_key) {
	long_key.split('$').reduce((obj, key, i, a) => {
		return obj[key] || (obj[key] = (i === a.length - 1 ? source[long_key] : {}));
	}, dest);
}
