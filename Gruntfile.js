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
					//cwd: '/',
					src: ['*.js', '!*.transpiled.js', '!Gruntfile.js'],
					dest: 'build/',
					ext: '.transpiled.js'
				}]
			}
		},
		watch: {
			all: {
				files: '<%= react.all.files[0].src %>',
				tasks: ['newer:react']
			}
		}
	});

	grunt.loadNpmTasks('grunt-react');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-newer');

	grunt.registerTask('default', ['react']);
};
