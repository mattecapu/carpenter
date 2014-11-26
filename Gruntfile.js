var js_files = ['*.js', '!Gruntfile.js', '!test.js'];

module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		react: {
			options: {
				harmony: true
			},
			all: {
				files: [{
					expand: true,
					src: js_files,
					dest: 'build/',
					ext: '.js'
				}]
			}
		},
		watch: {
			all: {
				files: js_files,
				tasks: ['newer:react']
			}
		}
	});

	grunt.loadNpmTasks('grunt-react');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-newer');

	grunt.registerTask('default', ['react']);
};
