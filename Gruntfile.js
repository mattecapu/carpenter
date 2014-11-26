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
				tasks: ['newer:react']
			}
		}
	});

	grunt.loadNpmTasks('grunt-react');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-newer');

	grunt.registerTask('default', ['react']);
};
