module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		react: {
			options: {
				harmony: true
			},
			all: {
				files: {
					'typs-transpiled.js' : 'typs.js',
					'test-transpiled.js' : 'test.js'
				}
			}
		},
		watch: {
			all: {
				files: ['typs.js', 'test.js'],
				tasks: ['react']
			}
		}
	});

	grunt.loadNpmTasks('grunt-react');
	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', ['react']);
};
