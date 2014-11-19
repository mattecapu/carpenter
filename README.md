# Carpenter
A powerful declarative tool to automagically generate a JSON-API-compliant REST API from his description.

### Usage
This code creates a REST end-point for `users`.
```js
var mach = require('mach');
var carpenter = require('carpenter');
var db = require('./my-database-handler.js');

carpenter.setConnector(db.connection());

var rest_api = carpenter.declareCollection({
	name: 'users',
	type: {
		id: carpenter.types.id,
		email: carpenter.types.email,
		name: carpenter.type.string.len({max: 30}),
		best_friend: carpenter.types.id
	},
	keys: {
		primary: 'id',
		unique: ['email'],
		foreign: [{
			field: best_friend,
			collection: 'users'
		}]
	},
	actions: carpenter.actions.all
}).exposeAPI();
```
Now the server is capable of handling any of these requests
* `GET /users`
* `GET /users/1`
* `GET /users/1/linked/best_friend`
* `GET /users/1?fields=name`
* `POST /users   {email: 'foo@bar.com', name: 'Foo Bar', best_friend: 1}`
* and almost every other possible request made in the limits of the [JSON API format](http://jsonapi.org/format/)

### License
Good, ol', [MIT license](http://github.com/mattecapu/carpenter/blob/master/LICENSE)