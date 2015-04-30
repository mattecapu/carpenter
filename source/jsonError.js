/*!
	JSON API Error object
*/

export default function ({title, details, status, code, href, links, path, id}) {
	// essential info
	this.object = {
		title: title || 'Error',
		details: details || 'A unspecified error was fired by the application',
		status: status || 400
	};

	// optional info: let's not pollute the error object with empty fields
	if (code)  object.code = code;
	if (href)  object.href = href;
	if (links) object.links = links;
	if (path)  object.path = path;
	if (id)    object.id = id;
}
