module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		babel: {
			all: {
				files: [{
					expand: true,
					cwd: 'source/',
					src: '*.js',
					dest: 'build/',
					ext: '.js'
				}]
			}
		},
		watch: {
			all: {
				files: 'source/*.js',
				tasks: ['newer:babel']
			}
		}
	});

	grunt.loadNpmTasks('grunt-babel');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-newer');

	grunt.registerTask('default', ['babel']);
};
