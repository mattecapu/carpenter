/*!
	Check if all the fields given actually belong of a specified resource
*/


var allFieldsExist = function (fields, resource_name, context) {
	return fields.every((field) => {
		return -1 !== Object.keys(context.resources[resource_name].structure).indexOf(field);
	});
};

module.exports = allFieldsExist;
